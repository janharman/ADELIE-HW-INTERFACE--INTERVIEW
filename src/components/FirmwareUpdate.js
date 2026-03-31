import React, { useState, useRef } from 'react';
import './FirmwareUpdate.css';

/**
 * FirmwareUpdate - Handles Intel HEX parsing into a 256KB binary buffer.
 */
const FirmwareUpdate = ({ blInfo, productInfo }) => {
    const [fileName, setFileName] = useState('');
    const [status, setStatus] = useState('Idle');
    const [fileStats, setFileStats] = useState({fw: '--', date: '--', hw: '--', crc: '--', bl: '--', info: '--' });
    const fileInputRef = useRef(null);
    
    // The 256KB binary buffer
    const firmwareBuffer = useRef(new Uint8Array(256 * 1024).fill(0xFF));

    const isHardwareConnected = true; 
    const inBootloader = blInfo && blInfo.sts !== 0;
    const badCrc = blInfo && blInfo.sts === 0xEE;

    const triggerFileSelect = () => fileInputRef.current.click();

	/**
	 * Parses Intel HEX
	 */
	const parseHexFile = (text) => {
		firmwareBuffer.current.fill(0xFF);
		const lines = text.split(/\r?\n/);
		let extendedAddress = 0;
		console.log('file loaded')
		let finish = false;

		for (let line of lines) {
			line = line.trim();
			if (!line.startsWith(':')) continue;

			const byteCount = parseInt(line.substring(1, 3), 16);
			const address = parseInt(line.substring(3, 7), 16);
			const recordType = parseInt(line.substring(7, 9), 16);
			const dataStr = line.substring(9, 9 + (byteCount * 2));

			switch (recordType)
			{
			case 0x00:	// Data
				const targetAddress = extendedAddress + address;
				for (let i = 0; i < byteCount; i++) {
					if (targetAddress + i < firmwareBuffer.current.length) {
						firmwareBuffer.current[targetAddress + i] = parseInt(dataStr.substring(i * 2, i * 2 + 2), 16);
					}
				}
				break;
			case 0x01:	// End of file
				finish = true;
				break;
			case 0x02:	// Extended Segment Address
				extendedAddress = parseInt(line.substring(9, 13), 16) << 4;
				break;
			case 0x04:	// Extended Linear Address
				extendedAddress = parseInt(line.substring(9, 13), 16) << 16;
				break;
			}
			if (finish) break;
		}
	}

	const FW_ADR_ADDRESSES = 0x1E000
	const FW_ADR_FW_INFO = 0x1E200
	const FW_ADR_CRC = 0x1F000
	const PROGRAM_CRC_STS_ASSIGNED = 0x1CAC2ACA;
	const PROGRAM_CRC_NEED_TO_ASSIGN = 0xAB01CD02;

	const extractFwInfoFromHex = () => {
		// Create a view starting at zero
		const view = new DataView(firmwareBuffer.current.buffer);


		// Read char Info[160]
		const infoBytes = firmwareBuffer.current.slice(FW_ADR_FW_INFO + 16, FW_ADR_FW_INFO + 16 + 160);
		const infoText = new TextDecoder().decode(infoBytes).split('\0')[0];
		let di = infoText.indexOf('Date:');
		let date = '--';
		if (di > 20) date = infoText.slice(di+6, di+12);

		// CRC - calculate, because there is no CRC in new firmware
		let addr = view.getUint32(FW_ADR_ADDRESSES+0, true);
		let size = view.getUint32(FW_ADR_ADDRESSES+4, true) >> 2;
		let crc = 0;
		if ((addr === 0) && (size < ((256*1024)/4)))
		{
			while (size--) {
				crc ^= view.getUint32(addr, true);
				addr += 4;
			}
		}
		view.setUint32(FW_ADR_CRC+0, PROGRAM_CRC_STS_ASSIGNED, true);
		view.setUint32(FW_ADR_CRC+4, crc, true);

		// Check for valid ID (optional, e.g., if ID should be a specific magic number)
		// --- EXTRACTION OF tFirmwareInfo.ID AT 0x1E200 ---
		const fwID   = view.getUint32(FW_ADR_FW_INFO, true);  // ID
		if (fwID !== 0xFFFFFFFF) {
			setFileStats({
				fw: view.getUint32(FW_ADR_FW_INFO+4, true),
				date: date,        // Assuming Fw int is the 0x00YYMMDD date
				hw: formatVersion(view.getUint32(FW_ADR_FW_INFO+8, true)),
				bl: '--',
				crc: (crc >>> 0).toString(16).padStart(8, '0').toUpperCase(), // CRC calculation would happen over the whole buffer
				info: infoText || 'No Info'
			});
			setStatus('Ready');
		} else {
			setStatus('Error: Invalid Firmware ID');
		}		
	};

    const formatDate = (dateValue) => {
        if (!dateValue || dateValue === 0) return '--.--.----';
        const hex = dateValue.toString(16).padStart(8, '0');
        return `${hex.substring(6, 8)}.${hex.substring(4, 6)}.20${hex.substring(2, 4)}`;
    };

    const formatVersion = (ver) => {
        if (!ver || ver === 0) return '--';
        return ver.toString(16).toUpperCase();
    };

    const onFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setFileName(file.name);
        setStatus('Loading');

        const reader = new FileReader();
        reader.onload = (event) => {
            parseHexFile(event.target.result);
			extractFwInfoFromHex();
        };
        reader.readAsText(file);
    };

    return (
        <div className="fw-update-content">
            <div className="fw-file-row">
                <input type="text" className="fw-path-display" value={fileName} placeholder="Select HEX..." readOnly />
                <input type="file" ref={fileInputRef} accept=".hex" onChange={onFileSelect} hidden />
                <button className="fw-browse-btn" onClick={triggerFileSelect}>Browse...</button>
            </div>

            <div className="fw-main-grid">
                <div className="fw-table-section">
                    <table className="fw-comparison-table">
                        <thead>
                            <tr>
                                <th>Property</th>
                                <th>Firmware File</th>
                                <th>Device</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td>Firmware Version</td><td className="val-file">{fileStats.fw}</td><td className="val-device">{formatVersion(productInfo?.fw)}</td></tr>
                            <tr><td>Firmware Date</td><td className="val-file">{fileStats.date}</td><td className="val-device">{formatDate(productInfo?.date)}</td></tr>
                            <tr><td>Hardware Version</td><td className="val-file">{fileStats.hw}</td><td className="val-device">{formatVersion(productInfo?.hw)}</td></tr>
                            <tr><td>Firmware CRC</td><td className="val-file">{fileStats.crc}</td><td className="val-device">--</td></tr>
                            <tr><td>Bootloader Version</td><td className="val-file">{fileStats.bl}</td><td className="val-device">{formatVersion(blInfo?.ver)}</td></tr>
                            <tr><td>Firmware Info</td><td className="val-file">{fileStats.info}</td><td className="val-device">{productInfo?.info || '---'}</td></tr>
                        </tbody>
                    </table>
                </div>

                <div className="fw-control-sidebar">
                    <div className="fw-btn-group">
                        <button className="fw-cmd-btn mini">Bootloader</button>
                        <button className="fw-cmd-btn mini">Reset</button>
                        <button className="fw-start-btn primary mini">FLASH</button>
                    </div>

                    <div className="fw-indicators compact">
                        <div className="indicator-item">
                            <div className={`ind-dot ${isHardwareConnected ? 'dot-on-green' : 'dot-off'}`}></div>
                            <span>Conn</span>
                        </div>
                        <div className="indicator-item">
                            <div className={`ind-dot ${inBootloader ? 'dot-on-blue' : 'dot-off'}`}></div>
                            <span>BL</span>
                        </div>
                        <div className="indicator-item">
                            <div className={`ind-dot ${badCrc ? 'dot-on-red' : 'dot-off'}`}></div>
                            <span>CRC Error</span>
                        </div>
                        
                        <div className="bl-info-block mini">
                            <div className="bl-info-item"><span>V: {formatVersion(blInfo?.ver)}</span></div>
                            <div className="bl-info-item"><span>D: {formatDate(blInfo?.date)}</span></div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="fw-secondary-table-area">
                {/* Secondary table for memory map or status will go here */}
            </div>
        </div>
    );
};

export default FirmwareUpdate;