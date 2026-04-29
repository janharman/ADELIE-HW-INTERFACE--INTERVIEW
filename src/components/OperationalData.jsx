import React, { useState, useEffect } from 'react';
import './OperationalData.css';

/**
 * Operational Data component.
 * Displays configuration and actual HW temperature for tuning.
 */
function OperationalData({ onCommand, runtimeData, productInfo }) {
    const [config, setConfig] = useState({
        limitB1: 3000, limitB2: 3000, limitB3: 3000,
        timeoutB1: 10, timeoutB2: 10, timeoutB3: 10,
        fanTemp: 45,
        termRes: 0
    });

    const [noPcConfig, setNoPcConfig] = useState({
        timeout: 10,
        bits: []
    });

    // HW version check for termination
    const isTerminationSupported = () => {
        if (!productInfo || !productInfo.hw) return false;
        const hw = productInfo.hw; 
        const match = hw.match(/H(\d+)([A-Z])/);
        if (!match) return false;
        const num = parseInt(match[1]);
        const letter = match[2];
        return (num > 9) || (num === 9 && letter >= 'B');
    };

    // Auto-read on mount
    useEffect(() => {
        readFromHW();
    }, []);

    // Sync config from HW response
    useEffect(() => {
        if (runtimeData && runtimeData.isOperationalResponse) {
            const d = runtimeData.operationalPayload;
            if (!d || d.length < 6) return;

            const unpack = (val) => ({
                limit: val & 0xFFFF,
                timeout: (val >> 16) & 0xFFFF
            });

            const b1 = unpack(d[0]);
            const b2 = unpack(d[1]);
            const b3 = unpack(d[2]);
            
            const noPcWord = d[4];
            const activeBits = [];
            const noPcMsb = (noPcWord >> 16) & 0xFFFF;
            for(let i=0; i<16; i++) {
                if (noPcMsb & (1 << i)) activeBits.push(i);
            }

			let fanT = (d[3] & 0xFFFF);
			if (fanT > 60) fanT /= 10;	// probably older version <= 260417
            setConfig({
                limitB1: b1.limit, timeoutB1: b1.timeout,
                limitB2: b2.limit, timeoutB2: b2.timeout,
                limitB3: b3.limit, timeoutB3: b3.timeout,
                fanTemp: fanT, // UI shows decimal from HW tenths
                termRes: d[5] & 0x07
            });

            setNoPcConfig({
                timeout: noPcWord & 0xFFFF,
                bits: activeBits
            });
        }
    }, [runtimeData.timestamp]);

    const saveAllToHW = () => {
        // Asymmetric fix: Write as whole units (0-60), Read as tenths
        const fanTempToSave = Math.min(Math.max(parseInt(config.fanTemp, 10) || 0, 0), 60);

        const packBranch = (limit, timeout) => {
            return (parseInt(limit) & 0xFFFF) | ((parseInt(timeout) & 0xFFFF) << 16);
        };

        const payload = [
            packBranch(config.limitB1, config.timeoutB1),
            packBranch(config.limitB2, config.timeoutB2),
            packBranch(config.limitB3, config.timeoutB3),
            fanTempToSave & 0xFFFF, // Writing 1:1 units
            ((noPcConfig.bits.reduce((acc, b) => acc | (1 << b), 0) << 16) | (noPcConfig.timeout & 0xFFFF)),
            config.termRes & 0x07
        ];

        onCommand('Save Operational Data', 0x53, 0, payload);
    };

    const readFromHW = () => onCommand('Read Operational Data', 0x53, 0, 'READ');

    // Display actual temperature from runtimeData (assuming .Temp exists)
    // If your temperature field is named differently, change it here:
	const at = (runtimeData[36] + (runtimeData[37] << 8));
	const actualTemp = isNaN(at)?'--.-': (at/10).toFixed(1);

    return (
        <div className="operational-container">
            <div className="op-vertical-layout">
                
                {/* BRANCH SETUP */}
                <section className="op-card">
                    <h3>Branch Protection Setup</h3>
                    {[1, 2, 3].map(num => (
                        <div key={num} className="op-branch-row">
                            <label className="branch-label">Branch #{num}</label>
                            <div className="input-group">
                                <span>Limit:</span>
                                <input type="number" min="1000" max="4000"
                                    value={config[`limitB${num}`]} 
                                    onChange={(e) => setConfig({...config, [`limitB${num}`]: e.target.value})}
                                />
                                <span className="unit">mA</span>
                            </div>
                            <div className="input-group">
                                <span>Timeout:</span>
                                <input type="number" min="1" max="60"
                                    value={config[`timeoutB${num}`]} 
                                    onChange={(e) => setConfig({...config, [`timeoutB${num}`]: e.target.value})}
                                />
                                <span className="unit">sec</span>
                            </div>
                        </div>
                    ))}
                </section>

                {/* NO PC COMMUNICATION */}
                <section className="op-card">
                    <h3>No PC Communication Behaviour</h3>
                    <div className="op-row">
                        <label>Watchdog Timeout (sec):</label>
                        <input type="number" value={noPcConfig.timeout}
                            onChange={(e) => setNoPcConfig({...noPcConfig, timeout: parseInt(e.target.value)})}
                        />
                    </div>
                    <div className="behaviour-bits-grid">
                        {[
                            { b: 0, l: 'Sem. Red' }, { b: 1, l: 'Sem. Orange' }, { b: 2, l: 'Sem. Green' },
                            { b: 4, l: 'LED Error' }, { b: 5, l: 'LED Warning' }, { b: 6, l: 'LED OK' },
                            { b: 8, l: 'Relay 1' }, { b: 9, l: 'Relay 2' }, { b: 10, l: 'Relay 3' }, { b: 11, l: 'Relay 4' },
                            { b: 12, l: 'Fast Flash' }, { b: 13, l: '50:50 Period' }
                        ].map(item => (
                            <button key={item.b}
                                className={`bit-btn ${noPcConfig.bits.includes(item.b) ? 'active' : ''}`}
                                onClick={() => {
                                    const newBits = noPcConfig.bits.includes(item.b)
                                        ? noPcConfig.bits.filter(b => b !== item.b)
                                        : [...noPcConfig.bits, item.b];
                                    setNoPcConfig(prev => ({...prev, bits: newBits}));
                                }}
                            >
                                {item.l}
                            </button>
                        ))}
                    </div>
                </section>

                {/* SYSTEM SETUP with Actual Temp */}
                <section className="op-card">
                    <h3>System & Hardware Setup</h3>
                    <div className="op-row fan-row">
                        <div className="fan-input-side">
                            <label>Fan Trigger:</label>
                            <div className="input-group">
                                <input 
                                    type="number" 
                                    min="0" max="60" step="1"
                                    value={config.fanTemp} 
                                    onChange={(e) => {
                                        let v = e.target.value;
                                        if (v === '') { setConfig({...config, fanTemp: ''}); return; }
                                        let n = parseInt(v, 10);
                                        if (n > 60) n = 60;
                                        if (n < 0) n = 0;
                                        setConfig({...config, fanTemp: n});
                                    }} 
                                />
                                <span className="unit">°C</span>
                            </div>
                        </div>

                        <div className="actual-temp-display">
                            <span className="actual-label">ACTUAL HW TEMP:</span>
                            <span className="actual-value">{actualTemp} °C</span>
                        </div>
                    </div>

                    {isTerminationSupported() && (
                        <div className="termination-section">
                            <div className="resistor-label">Terminating Resistors ({productInfo.hw}):</div>
                            <div className="resistor-grid">
                                {[0, 1, 2].map(i => (
                                    <button key={i}
                                        className={`res-btn ${config.termRes & (1 << i) ? 'active' : ''}`}
                                        onClick={() => setConfig({...config, termRes: config.termRes ^ (1 << i)})}
                                    >
                                        Port P{i + 1}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                <div className="op-save-container">
                    <button className="read-btn" onClick={readFromHW}>🔍 READ FROM HW</button>
                    <button className="save-all-btn" onClick={saveAllToHW}>📥 WRITE ALL TO HW</button>
                </div>
            </div>
        </div>
    );
}

export default OperationalData;