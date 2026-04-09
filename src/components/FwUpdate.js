import React, { useState, useRef, useEffect } from 'react';
import FwFileLoader from './FwFileLoader';
import FwFlashMap from './FwFlashMap';
import FwFlashing from './FwFlashing';
import './FwUpdate.css';

const FirmwareUpdate = ({ blInfo, productInfo, onCommand }) => {
    const [status, setStatus] = useState('Idle');
    const [fileStats, setFileStats] = useState({ fw: '--', date: '--', hw: '--', crc: '--', bl: '--', info: '--' });
	const [showMap, setShowMap] = useState(false);
    const [flashProgress, setFlashProgress] = useState({ currentIdx: null, results: {}});
	const [canFlash, setCanFlash] = useState(false);
    const firmwareBuffer = useRef(new Uint8Array(256 * 1024).fill(0xFF));

    // Callback, který zavolá FwFileLoader, až bude hotov s parsováním
    const handleFileParsed = (stats) => {
        setFileStats(stats);
        setStatus('Ready');
    };

	useEffect(() => {
		setCanFlash((status === 'Ready') && (blInfo.sts & 1));
		console.log('Status: '+status, '- Running in bootloader = '+(blInfo.sts & 1));
	}, [status, blInfo])
	
    const formatVersion = (ver) => (!ver || ver === 0) ? '--' : ver.toString();
    const formatDate = (dateValue) => {
        if (!dateValue || dateValue === 0) return '--.--.----';
        const hex = dateValue.toString(16).padStart(8, '0');
        return `${hex.substring(6, 8)}.${hex.substring(4, 6)}.20${hex.substring(2, 4)}`;
    };

	const flash = async () => {
		if (status !== 'Ready') return;
		
		setStatus('Flashing');
		const CHUNK_SIZE = 256;
		const MAX_ADDRESS = 128 * 1024;
		const buffer = firmwareBuffer.current;

		// 1. Identifikace aktivních bloků (stejná logika jako v FwFlashing)
		const activeChunks = [];
		for (let i = 0; i < MAX_ADDRESS / CHUNK_SIZE; i++) {
			const start = i * CHUNK_SIZE;
			let hasData = false;
			for (let j = 0; j < CHUNK_SIZE; j++) {
				if (buffer[start + j] !== 0xFF) { hasData = true; break; }
			}
			if (hasData) activeChunks.push(i);
		}

		// Resetujeme progress bar
		setFlashProgress({ currentIdx: null, results: {} });

		// Flash Start -> send number of chunks
		const response = await onCommand(`Flash Init ${activeChunks.length}`, 0xBE, activeChunks.length, []);

		// 2. Postupné odesílání
		for (const chunkIdx of activeChunks) {
			setFlashProgress(prev => ({ ...prev, currentIdx: chunkIdx }));
			
			const startAddr = chunkIdx * CHUNK_SIZE;
			const dataChunk = buffer.slice(startAddr, startAddr + CHUNK_SIZE);
			let numOfTries = 0;
			while (numOfTries < 5)
			{
				try {
					// Zavoláme handleManualCommand z App.js
					// Musíme ji upravit, aby přijímala i dataChunk!
					const response = await onCommand(`Flash block ${chunkIdx} addr: 0x${startAddr.toString(16)}`, 0xBF, startAddr, dataChunk);

					// Tady předpokládáme, že response[0] == 0xC1 (nebo 0xBF) znamená OK
					if (response && response.length > 0) {
						setFlashProgress(prev => ({
							...prev,
							// currentIdx: null,
							results: { ...prev.results, [chunkIdx]: 'ok' }
						}));
						break;
					} else {
						throw new Error("No response from device");
					}
				} catch (err) {
					console.error(`Flash error at 0x${startAddr.toString(16)}:`, err);
					setFlashProgress(prev => ({
						...prev,
						// currentIdx: null,
						results: { ...prev.results, [chunkIdx]: 'er' }
					}));
					numOfTries++;
					if (numOfTries >= 5)
					{
						setStatus('Error');
						return; // Stop at error
					}
				}
			}
		}

		setStatus('Flash - Done');
		// alert("Firmware update successful!");
	};

	const resetStatus = () => {
		// if (status !== 'Error') return;
		setStatus('Ready');
		setFlashProgress({ currentIdx: null, results: {} });
	}

    return (
        <div className="fw-update-content">
            <div className="fw-main-grid">
				{/* 1. Komponenta pro výběr a parsování souboru */}
				<FwFileLoader 
					buffer={firmwareBuffer.current} 
					onParsed={handleFileParsed} 
					onStatus={setStatus} 
				/>

                <div className="fw-table-section">
                    <table className="fw-comparison-table">
                        <thead>
                            <tr><th>Property</th><th>Firmware File</th><th>Device</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>FW Version</td><td className="val-file">{fileStats.fw}</td><td className="val-device">{formatVersion(productInfo?.fw)}</td></tr>
                            <tr><td>FW Date</td><td className="val-file">{fileStats.date}</td><td className="val-device">{productInfo?.date}</td></tr>
                            <tr><td>Hardware Ver.</td><td className="val-file">{fileStats.hw}</td><td className="val-device">{formatVersion(productInfo?.hw)}</td></tr>
                            <tr><td>FW CRC</td><td className="val-file">{fileStats.crc}</td><td className="val-device">--</td></tr>
                            <tr><td>FW Info</td><td className="val-file info-text">{fileStats.info}</td><td className="val-device info-text">{productInfo?.info || '---'}</td></tr>
                        </tbody>
                    </table>
                </div>

				<FwFlashing buffer={firmwareBuffer.current} progress={flashProgress} status={status}/>

				{showMap && (<FwFlashMap buffer={firmwareBuffer.current} />)}

			</div> {/* Main Content */}

			{/* 2. Side panel for flash control */}
			<div className="fw-control-sidebar">
				<div className="fw-btn-group">
					<button className="fw-cmd-btn" onClick={() => onCommand('Go To Bootloader', 0xB0, 0x1234ABCD)}>GO TO BOOTLOADER</button>
					<button className="fw-cmd-btn" onClick={() => onCommand('Device Reset', 0xB0, 0x1234FFAA)}>DEVICE RESET</button>
					<button className={`fw-cmd-btn status ${(status==='Error')?'in-error':''}`} onClick={() => resetStatus()}>{(status=='Error')?'ERROR - click to reset': status}</button>
					<button className="fw-start-btn primary" disabled={!canFlash} onClick={() => flash()}>FLASH FIRMWARE</button>
				</div>
				<div className="fw-indicators">

					<div className="toggle-container" onClick={() => setShowMap(!showMap)}>
                        <div className={`toggle-switch ${showMap ? 'on' : 'off'}`}>
                            <div className="toggle-handle"></div>
                        </div>
                        <span className="toggle-label">Show Flash Map</span>
                    </div>

					<div className="indicator-item">
						<div className={`ind-dot ${(blInfo.ver) ? 'dot-on-green' : 'dot-off'}`}></div>
						<span>Connected</span>
					</div>
					<div className="indicator-item">
						<div className={`ind-dot ${(blInfo.sts & 1) ? 'dot-on-blue' : 'dot-off'}`}></div>
						<span>Running in Bootloader</span>
					</div>
					<div className="indicator-item">
						<div className={`ind-dot ${(blInfo.sts & 2) ? 'dot-on-red' : 'dot-off'}`}></div>
						<span>CRC Error</span>
					</div>
					
					<div className="bl-info-block">
						<div className="bl-info-item"><span>Bootloader<br></br>Version: {formatVersion(blInfo?.ver)}<br></br>
							Date: {formatDate(blInfo?.date)}</span></div>
					</div>
				</div>
			</div>
            
            {/* 3. Komponenta Hex Exploreru */}
            {/* <FwHexExplorer 
                buffer={firmwareBuffer.current} 
                offset={viewOffset} 
            /> */}
        </div>
    );
};

export default FirmwareUpdate;