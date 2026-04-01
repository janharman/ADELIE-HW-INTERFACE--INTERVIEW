import React, { useState, useRef } from 'react';

const FwFileLoader = ({ buffer, onParsed, onStatus }) => {
    const [fileName, setFileName] = useState('');
    const fileInputRef = useRef(null);

    const FW_ADR_ADDRESSES = 0x1E000;
    const FW_ADR_FW_INFO = 0x1E200;
    const FW_ADR_CRC = 0x1F000;
    const PROGRAM_CRC_STS_ASSIGNED = 0x1CAC2ACA;

    const parseHex = (text) => {
        buffer.fill(0xFF);
        const lines = text.split(/\r?\n/);
        let extendedAddress = 0;
        let finish = false;

        for (let line of lines) {
            line = line.trim();
            if (!line.startsWith(':')) continue;

            const byteCount = parseInt(line.substring(1, 3), 16);
            const address = parseInt(line.substring(3, 7), 16);
            const recordType = parseInt(line.substring(7, 9), 16);
            const dataStr = line.substring(9, 9 + (byteCount * 2));

            switch (recordType) {
                case 0x00: // Data
                    const target = extendedAddress + address;
                    for (let i = 0; i < byteCount; i++) {
                        if (target + i < buffer.length) {
                            buffer[target + i] = parseInt(dataStr.substring(i * 2, i * 2 + 2), 16);
                        }
                    }
                    break;
                case 0x01: finish = true; break;
                case 0x02: extendedAddress = parseInt(line.substring(9, 13), 16) << 4; break;
                case 0x04: extendedAddress = parseInt(line.substring(9, 13), 16) << 16; break;
                default: break;
            }
            if (finish) break;
        }
    };

    const runAnalysis = () => {
        const view = new DataView(buffer.buffer);
        
        // CRC Výpočet
        let addr = view.getUint32(FW_ADR_ADDRESSES, true);
        let size = view.getUint32(FW_ADR_ADDRESSES + 4, true) >> 2;
        let crc = 0;
        if (addr === 0 && size < (buffer.length / 4)) {
            while (size--) {
                crc ^= view.getUint32(addr, true);
                addr += 4;
            }
        }
        view.setUint32(FW_ADR_CRC, PROGRAM_CRC_STS_ASSIGNED, true);
        view.setUint32(FW_ADR_CRC + 4, crc, true);

        // Metadata
        const infoBytes = buffer.slice(FW_ADR_FW_INFO + 16, FW_ADR_FW_INFO + 176);
        const infoText = new TextDecoder().decode(infoBytes).split('\0')[0];
        let di = infoText.indexOf('Date:');
        
        onParsed({
            fw: view.getUint32(FW_ADR_FW_INFO + 4, true).toString(16).toUpperCase(),
            date: di > -1 ? infoText.slice(di + 5, di + 11) : '--',
            hw: view.getUint32(FW_ADR_FW_INFO + 8, true).toString(16).toUpperCase(),
            bl: '--',
            crc: (crc >>> 0).toString(16).padStart(8, '0').toUpperCase(),
            info: infoText || 'No Info'
        });
    };

    const handleSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setFileName(file.name);
        onStatus('Loading');
        const reader = new FileReader();
        reader.onload = (ev) => {
            parseHex(ev.target.result);
            runAnalysis();
        };
        reader.readAsText(file);
    };

    return (
        <div className="fw-file-row">
            <input type="text" className="fw-path-display" value={fileName} placeholder="Select HEX..." readOnly />
            <input type="file" ref={fileInputRef} accept=".hex" onChange={handleSelect} hidden />
            <button className="fw-browse-btn" onClick={() => fileInputRef.current.click()}>Browse...</button>
        </div>
    );
};

export default FwFileLoader;