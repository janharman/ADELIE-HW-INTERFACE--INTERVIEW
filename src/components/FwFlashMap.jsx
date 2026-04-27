import React from 'react';
import './FwFlashMap.css';

export const FLASH_MEMORY_LAYOUT = [
    { strt: 0x00000, size: 0x08000, type: 2, label: 'BOOTLOADER' },
    { strt: 0x08000, size: 0x01000, type: 2, label: 'BOOT-FIX' },
    { strt: 0x1C000, size: 0x01000, type: 1, label: 'Setup' },
    { strt: 0x1E000, size: 0x01000, type: 1, label: 'Cal-Data' },
    { strt: 0x1F000, size: 0x01000, type: 1, label: 'Dev ID' },
    { strt: 0x20000, size: 0x1E000, type: 0, label: 'FW' },
    { strt: 0x3E000, size: 0x01000, type: 0, label: 'FW-Info' },
    { strt: 0x3F000, size: 0x01000, type: 0, label: 'FW-CRC' },
];

const FwFlashMap = ({ buffer }) => {
	const SECTOR_SIZE = 4096;
	const PART_SIZE = 256;
    const COLUMN_SIZE = SECTOR_SIZE;  		// 4 kB na buňku
	const COLUMN_PARTS = COLUMN_SIZE / PART_SIZE;
    const ROW_SIZE = COLUMN_SIZE * 4;   // 16 kB na řádek
    const TOTAL_ROWS = 16;         		// 16 řádků pro 256 kB

    // Funkce pro kontrolu, zda jsou v 4kB bloku nějaká data
    const hasData = (addr) => {
        for (let i = 0; i < COLUMN_SIZE; i++) {
            if (buffer[addr + i] !== 0xFF) return true;
        }
        return false;
    };

	const partData = (addr) => {
        for (let i = 0; i < PART_SIZE; i++) {
            if (buffer[addr + i] !== 0xFF) return true;
        }
        return false;
    };

    const getTypeClass = (type) => {
        switch (type) {
            case 0: return 'fw';
            case 1: return 'setup';
            case 2: return 'boot';
            default: return 'empty';
        }
    };

    const getCellInfo = (addr) => {
        const match = FLASH_MEMORY_LAYOUT.find(
            (item) => addr >= item.strt && addr < (item.strt + item.size)
        );
        return match ? { label: match.label, type: match.type } : { label: '-', type: -1 };
    };

    const rows = [];
    for (let i = 0; i < TOTAL_ROWS; i++) {
        const rowStartAddr = i * ROW_SIZE;
        const columns = [];
        
        for (let j = 0; j < 4; j++) {
            const cellAddr = rowStartAddr + (j * COLUMN_SIZE);
            const active = hasData(cellAddr); // Kontrola dat v HEXu
            
			const colpart = [];
			for (let k=0; k < COLUMN_PARTS; k++)
			{
				 colpart.push({
					yes: partData(cellAddr + k * PART_SIZE)
				 });
			}
            columns.push({
                addr: cellAddr,
                active: active,
				part: colpart,
                ...getCellInfo(cellAddr)
            });
        }
        rows.push({ startAddr: rowStartAddr, cells: columns });
    }

    return (
        <div className="fw-flash-map-container">
            <h3 className="map-title">Flash Memory Geometry (256 kB)</h3>
            <table className="flash-grid-table">
                <thead>
                    <tr>
                        <th>Base Addr</th>
                        <th>+0000</th>
                        <th>+1000</th>
                        <th>+2000</th>
                        <th>+3000</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.startAddr}>
                            <td className="base-addr">
                                {row.startAddr.toString(16).toUpperCase().padStart(5, '0')}
                            </td>
                            {row.cells.map((cell) => (
                                <td 
                                    key={cell.addr} 
                                    className={`flash-cell ${getTypeClass(cell.type)} ${!cell.active ? 'inactive' : ''}`}
                                    title={cell.active ? `Data present at 0x${cell.addr.toString(16).toUpperCase()}` : 'Empty sector'}
                                >
									<div className="cell-label">
										{/* Text zobrazíme jen pokud jsou v buňce data */}
										{cell.active? cell.label: '.'}
									</div>
									<div className='cell-parts'>
										{cell.part.map((part) => (
											<div className={`cell-part-div ${part.yes?'has-data':''}`}></div>
										))}
									</div>
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            
            <div className="map-legend">
                <span className="legend-item"><i className="color-box fw"></i> Firmware</span>
                <span className="legend-item"><i className="color-box setup"></i> Setup</span>
                <span className="legend-item"><i className="color-box boot"></i> Bootloader</span>
                <span className="legend-item">Each cell is one sector = 4096 Bytes. Each sector is divided to 16 (communication) parts.</span>
            </div>
        </div>
    );
};

export default FwFlashMap;