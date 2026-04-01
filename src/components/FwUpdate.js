import React, { useState, useRef } from 'react';
import FwFileLoader from './FwFileLoader';
import FwFlashMap from './FwFlashMap';
// import FwHexExplorer from './FwHexExplorer';
import './FwUpdate.css';

const FirmwareUpdate = ({ blInfo, productInfo, onCommand }) => {
    const [status, setStatus] = useState('Idle');
    const [viewOffset, setViewOffset] = useState(0x1E000);
    const [fileStats, setFileStats] = useState({ fw: '--', date: '--', hw: '--', crc: '--', bl: '--', info: '--' });
    
    // Hlavní buffer zůstává zde, aby k němu měly přístup všechny komponenty
    const firmwareBuffer = useRef(new Uint8Array(256 * 1024).fill(0xFF));

    // Callback, který zavolá FwFileLoader, až bude hotov s parsováním
    const handleFileParsed = (stats) => {
        setFileStats(stats);
        setStatus('Ready');
    };

    const formatVersion = (ver) => (!ver || ver === 0) ? '--' : ver.toString(16).toUpperCase();
    const formatDate = (dateValue) => {
        if (!dateValue || dateValue === 0) return '--.--.----';
        const hex = dateValue.toString(16).padStart(8, '0');
        return `${hex.substring(6, 8)}.${hex.substring(4, 6)}.20${hex.substring(2, 4)}`;
    };

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
                            <tr><td>FW Date</td><td className="val-file">{fileStats.date}</td><td className="val-device">{formatDate(productInfo?.date)}</td></tr>
                            <tr><td>Hardware Ver.</td><td className="val-file">{fileStats.hw}</td><td className="val-device">{formatVersion(productInfo?.hw)}</td></tr>
                            <tr><td>FW CRC</td><td className="val-file">{fileStats.crc}</td><td className="val-device">--</td></tr>
                            <tr><td>Bootloader Ver.</td><td className="val-file">{fileStats.bl}</td><td className="val-device">{formatVersion(blInfo?.ver)}</td></tr>
                            <tr><td>FW Info</td><td className="val-file">{fileStats.info}</td><td className="val-device">{productInfo?.info || '---'}</td></tr>
                        </tbody>
                    </table>
                </div>

				{/* 2. Komponenta Memory Mapy */}
				<FwFlashMap 
					buffer={firmwareBuffer.current} 
					onCellClick={setViewOffset} 
				/>
			</div> {/* Main Content */}

			{/* 2. Side panel for flash control */}
			<div className="fw-control-sidebar">
				<div className="fw-btn-group">
					<button className="fw-cmd-btn mini" onClick={() => onCommand('Go To Bootloader', 0xB0, 0x1234ABCD)}>Go To Bootloader</button>
					<button className="fw-cmd-btn mini" onClick={() => onCommand('Device Reset', 0xB0, 0x1234FFAA)}>Device Reset</button>
					<button className="fw-start-btn primary mini" disabled={status !== 'Ready'}>FLASH FIRMWARE</button>
				</div>
				<div className="fw-indicators">
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