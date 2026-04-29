import React, { useMemo } from 'react';
import './FwFlashing.css';

const FwFlashing = ({ buffer, progress, status }) => {
    const CHUNK_SIZE = 256; // 256 Bytes
    const MIN_ADDRESS = 128 * 1024; // Start @ 2nd half of FLASH (128 kB)
    const MAX_ADDRESS = 256 * 1024;
    const TOTAL_CHUNKS = (MAX_ADDRESS - MIN_ADDRESS) / CHUNK_SIZE;

    // Vyfiltrujeme pouze obsazené bloky v první polovině paměti
    const activeChunks = useMemo(() => {
        const active = [];
        for (let i = 0; i < TOTAL_CHUNKS; i++) {
            const address = i * CHUNK_SIZE + MIN_ADDRESS;
            let hasData = false;
            
            // Kontrola, zda 1kB blok obsahuje jiná data než 0xFF
            for (let j = 0; j < CHUNK_SIZE; j++) {
                if (buffer[address + j] !== 0xFF) {
                    hasData = true;
                    break;
                }
            }

            if (hasData) {
                active.push({
                    idx: i,
                    addr: address
                });
            }
        }
        return active;
    }, [buffer, status, TOTAL_CHUNKS]);

    // Výpočet procenta dokončení na základě počtu aktivních bloků
    const completedCount = activeChunks.filter(c => progress.results[c.idx] === 'ok').length;
    const percent = activeChunks.length > 0 
        ? Math.round((completedCount / activeChunks.length) * 100) 
        : 0;

    return (
        <div className="fw-flashing-container">
            <div className="flashing-header">
                <div className="flashing-title">
                    FLASHING: <strong>{percent}%</strong>
                </div>
                <div className="flashing-details">
                    {completedCount} / {activeChunks.length} blocks (256 Bytes per block)
                </div>
            </div>

            {/* Progress bar z malých čtverečků */}
            <div className="progress-div">
                {activeChunks.map((chunk) => {
                    const result = progress.results[chunk.idx];
                    let statusClass = 'pending';
                    
                    if (result === 'ok') statusClass = 'success';
                    else if (result === 'er') statusClass = 'error';
                    else if (chunk.idx === progress.currentIdx) statusClass = 'writing';

                    return (
                        <div 
                            key={chunk.idx} 
                            className={`progress-step ${statusClass}`}
                            title={`Block ${chunk.idx} | Addr: 0x${chunk.addr.toString(16).toUpperCase()}`}
                        ></div>
                    );
                })}
            </div>

            <div className="flashing-footer">
                <span className="addr-now">
                    {progress.currentIdx !== null 
                        ? `Target: 0x${(progress.currentIdx * 256).toString(16).toUpperCase()}` 
                        : 'Waiting for start...'}
                </span>
            </div>
        </div>
    );
};

export default FwFlashing;
