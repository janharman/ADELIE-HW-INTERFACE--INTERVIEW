import React, { useState, useEffect, useRef } from 'react';
import './TestInterface.css';

/**
 * Sequential Diagnostic Test Component
 * Handles step-by-step hardware validation.
 */
function TestInterface({ isConnected, onCommand, runtimeData }) {
    const [currentStep, setCurrentStep] = useState(0);
    const [semaphoreIndex, setSemaphoreIndex] = useState(0);
    const semaphoreTimer = useRef(null);
    const [optoHistory, setOptoHistory] = useState(0);
    const [relayIndex, setRelayIndex] = useState(0);
    const relayTimer = useRef(null);
	const terminatingResTimer = useRef(null);
	const [termRes, setTermRes] = useState(0);
	const [rtd, setRtd] = useState({
		Pwr24V: 0,
		Pwr5V: 0,
		Pwr19V: 0,
		statusOk: 0,
		CurMinB1: 0,
		CurMinB2: 0,
		CurMinB3: 0,
		VoltOnB1: 0,
		VoltOnB2: 0,
		VoltOnB3: 0,
		CurHiB1: 0,
		CurHiB2: 0,
		CurHiB3: 0,
	});

    // Test sequence definition
    const steps = [
        { id: 1, label: 'Connection with ADÉLIE INTERFACE', type: 'auto' },
        { id: 2, label: 'Semaphore Output Test', type: 'manual' },
        { id: 3, label: 'Opto Inputs Test (Trigger all 4)', type: 'auto' },
        { id: 4, label: 'Relay Output Test', type: 'manual' },
		{ id: 5, label: 'On-Board Voltages', type: 'auto' },
		{ id: 6, label: 'Silent Current Measurement', type: 'auto' },
		{ id: 7, label: 'High-Current Measurement: Branch #1', type: 'manual' },
		{ id: 8, label: 'High-Current Measurement: Branch #2', type: 'manual' },
		{ id: 9, label: 'High-Current Measurement: Branch #3', type: 'manual' },
		{ id: 10, label: 'Modbus Communication Port #1', type: 'manual' },
		{ id: 11, label: 'Modbus Communication Port #2', type: 'manual' },
		{ id: 12, label: 'Modbus Communication Port #3', type: 'manual' },
		{ id: 13, label: 'Terminating Resistor Port #1', type: 'manual' },
    ];

    const turnOffAll = () => {
        // Turn off Semaphore LEDs (bits 16-19) and Relays (assuming bits 20-23)
        onCommand('All Outputs OFF', 0x52, 0, [0xFFFFFFFF]); 
    };

	// DEBUG: Jump to step
    const jumpToStep = (index) => {
        turnOffAll();
        setCurrentStep(index);
    };

    useEffect(() => {
		if (!(runtimeData && runtimeData.length >= 30)) return;
		let d = runtimeData;

		setRtd(prev => {
			let updated = { ...prev };

			// Vždy aktualizujeme status (to potřebujeme pro logiku)
			updated.statusOk = d[12] + (d[13] << 8) + (d[14] << 16) + (d[15] << 24);

			// Napětí aktualizujeme JEN pokud jsme v kroku 4 (nebo dříve)
			// Jakmile jsme v kroku 5+, zůstanou tam "zamrzlé" poslední hodnoty
			if (currentStep <= 4) {
				updated.Pwr24V = ((d[28] + (d[29] << 8)) / 1000).toFixed(1);
				updated.Pwr5V = ((d[32] + (d[33] << 8)) / 1000).toFixed(1);
				updated.Pwr19V = ((d[34] + (d[35] << 8)) / 1000).toFixed(1);
			}

			// Proudy aktualizujeme JEN pokud jsme v kroku 5 (nebo dříve)
			// Jakmile skočíme na Load Test (krok 6), klidové proudy "zamrznou"
			if (currentStep <= 5) {
				updated.CurMinB1 = d[16] + (d[17] << 8);
				updated.CurMinB2 = d[20] + (d[21] << 8);
				updated.CurMinB3 = d[24] + (d[25] << 8);
			}

			if (currentStep === 6) {
				updated.VoltOnB1 = (d[48] + (d[49] << 8)) / 1000;
				updated.CurHiB1 = d[16] + (d[17] << 8);
			}
			if (currentStep === 7) {
				updated.VoltOnB2 = (d[52] + (d[53] << 8)) / 1000;
				updated.CurHiB2 = d[20] + (d[21] << 8);
			}
			if (currentStep === 8) {
				updated.VoltOnB3 = (d[56] + (d[57] << 8)) / 1000;
				updated.CurHiB3 = d[24] + (d[25] << 8);
			}

			return updated;
		});
	}, [runtimeData, currentStep]);

    // STEPs Handling
    useEffect(() => {
		if (!(runtimeData && runtimeData.length >= 12)) return;
		// destroy timers
		if ((currentStep !== 3) && (relayTimer.current))
		{
			clearInterval(relayTimer.current);
			relayTimer.current = null;
		}
		if ((currentStep !== 1) && (semaphoreTimer.current))
		{
			clearInterval(semaphoreTimer.current);
			semaphoreTimer.current = null;
		}
		// switch according to STEP
        switch (currentStep) 
		{
			case 0: 	// ----------------------------- Interface Connection
				if (isConnected)
					setTimeout(() => setCurrentStep(1), 500);
				break;
			case 1: 	// ----------------------------- Semaphore Cycling
				if (semaphoreTimer.current) return;
				if (isConnected) {
					const runSemaphore = () => {
						setSemaphoreIndex((prev) => {
							const next = (prev + 1) % 4;
							const masks = [0x010000, 0x020000, 0x040000, 0x080000];
							onCommand(`Semaphore LED ${next + 1}`, 0x52, masks[next], [(~masks[next]) & 0xF0000]);
							return next;
						});
					};
					runSemaphore();
					semaphoreTimer.current = setInterval(runSemaphore, 850);				
				}
				else if (semaphoreTimer.current)
				{
					clearInterval(semaphoreTimer.current);
					semaphoreTimer.current = null;
				}
				break;
			case 2: 	// ----------------------------- OPTO INPUTS
				const currentInputs = runtimeData[4] & 0x0F;            
				setOptoHistory(prev => {
					const newHistory = prev | currentInputs;
					// If all 4 bits are 1 (0x0F), auto-advance
					if (newHistory === 0x0F) {
						setTimeout(() => setCurrentStep(3), 800);
					}
					return newHistory;
				});
				break;
			case 3: 	// ----------------------------- Relay Cycling
				if (relayTimer.current) return;
				console.log("Starting new Relay Timer");						
				// Definujeme funkci pro jeden krok
				const runNextRelay = () => {
					setRelayIndex((prev) => {
						const next = (prev + 1) % 4;
						const masks = [0x0001, 0x0002, 0x0004, 0x0008];
						onCommand(`Relay ${next + 1}`, 0x52, masks[next], [(~masks[next]) & 0x000F]);
						return next;
					});
				};
				// Hned první sepnutí
				runNextRelay();
				// A nastavení opakování
				relayTimer.current = setInterval(runNextRelay, 650);				
				break;
			case 4:		// ----------------------------- On-Board Voltages
				if ((rtd.statusOk & 0x70000) == 0x70000)
					setTimeout(() => setCurrentStep(prev => (prev === 4 ? 5 : prev)), 1200);
				break;
			case 5: 	// ----------------------------- Silent Current Measurement
				const currentLimit = 10;
				if ((rtd.CurMinB1 < currentLimit) && (rtd.CurMinB2 < currentLimit) && (rtd.CurMinB3 < currentLimit)) {
					// Pokud jsou proudy v klidu OK, můžeme jít na další krok
					setTimeout(() => setCurrentStep(prev => (prev === 5 ? 6 : prev)), 1600);
				}
				break;
			case 6:		// ----------------------------- High-Current Measurement - Branch #1
				onCommand('Branch #1', 0x52, 0x100, [0x600]);
				break;
			case 7:		// ----------------------------- High-Current Measurement - Branch #2
				onCommand('Branch #2', 0x52, 0x200, [0x500]);
				break;
			case 8:		// ----------------------------- High-Current Measurement - Branch #3
				onCommand('Branch #3', 0x52, 0x400, [0x300]);
				break;
			case 9:		// ----------------------------- Modbus Communication - Port #1
				onCommand('Branch #1', 0x52, 0x100, [0x600]);
				break;
			case 10:	// ----------------------------- Modbus Communication - Port #2
				onCommand('Branch #2', 0x52, 0x200, [0x500]);
				break;
			case 11:	// ----------------------------- Modbus Communication - Port #3
				onCommand('Branch #3', 0x52, 0x400, [0x300]);
				break;
			case 12:	// ----------------------------- Terminating Resistor - Port #1
			case 13:	// ----------------------------- Terminating Resistor - Port #2
			case 14:	// ----------------------------- Terminating Resistor - Port #3
				if (terminatingResTimer.current) return;
				const runTermRes = () => {
					setTermRes((prev) => {
						const next = (prev + 1) % 4;
						const masks = [0x0001, 0x0002, 0x0004, 0x0008];
						onCommand(`Relay ${next + 1}`, 0x52, masks[next], [(~masks[next]) & 0x000F]);
						return next;
					});
				};
				// Hned první sepnutí
				runTermRes();
				// A nastavení opakování
				terminatingResTimer.current = setInterval(runTermRes, 1500);				
				break;
		}
    }, [currentStep, runtimeData, isConnected]);

    const handleNext = () => {
        turnOffAll();
        setCurrentStep(prev => prev + 1);
    };

    const ledConfig = [
        { label: 'R', class: 'red' }, { label: 'O', class: 'orange' },
        { label: 'G', class: 'green' }, { label: 'B', class: 'blue' }
    ];

    return (
        <div className="test-interface-container dark-theme">
            <div className="steps-list">
                {steps.map((step, index) => {
                    const isActive = index === currentStep;
                    const isDone = index < currentStep;

                    return (
                        <div 
							key={step.id} 
							className={`step-row ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
							onClick={() => jumpToStep(index)}
						>
                            <div className="step-number-col">{step.id}.</div>
                            <div className="step-status-icon">{isDone ? '🟢' : isActive ? '🔵' : '⚪'}</div>
                            
                            <div className="step-label-col">
                                <span className="label-text">{step.label}</span>
                                
                                {/* Visual for Step 2: Semaphore */}
                                {isActive && step.id === 2 && (
                                    <div className="semaphore-visual">
                                        {ledConfig.map((led, i) => (
                                            <div key={i} className={`led-light ${led.class} ${semaphoreIndex === i ? 'on' : ''}`}>{led.label}</div>
                                        ))}
                                    </div>
                                )}

                                {/* Visual for Step 3: Opto Inputs */}
                                {(isActive || isDone) && step.id === 3 && (
                                    <div className="opto-visual">
                                        {[0, 1, 2, 3].map(i => (
                                            <div key={i} className={`opto-dot ${(optoHistory & (1 << i)) ? 'triggered' : ''}`}>
                                                IN #{i+1}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Visual for Step 4: Relays */}
                                {isActive && step.id === 4 && (
                                    <div className="relay-visual">
                                        {[0, 1, 2, 3].map(i => (
                                            <div key={i} className={`relay-box ${relayIndex === i ? 'on' : ''}`}>
                                                RE{i+1}
                                            </div>
                                        ))}
                                    </div>
                                )}

								{/* Step 5: On-Board Voltages */}
                                {step.id === 5 && (
                                    <div className="voltage-visual">
                                        <div><span>24VDC </span><span className={`v-tag ${(rtd.statusOk&0x10000) ? 'ok' : 'fail'}`}>{rtd.Pwr24V} V</span></div>
                                        <div><span>5VDC  </span><span className={`v-tag ${(rtd.statusOk&0x20000) ? 'ok' : 'fail'}`}>{rtd.Pwr5V} V</span></div>
                                        <div><span>19VDC </span><span className={`v-tag ${(rtd.statusOk&0x40000) ? 'ok' : 'fail'}`}>{rtd.Pwr19V} V</span></div>
                                    </div>
                                )}

								{/* Step 6: Silent Current Measurement */}
                                {step.id === 6 && (
                                    <div className="voltage-visual">
                                        <div><span>Branch #1</span><span className={`v-tag ${(rtd.CurMinB1 < 10) ? 'ok' : 'fail'}`}>{rtd.CurMinB1} mA</span></div>
                                        <div><span>Branch #2</span><span className={`v-tag ${(rtd.CurMinB2 < 10) ? 'ok' : 'fail'}`}>{rtd.CurMinB2} mA</span></div>
                                        <div><span>Branch #3</span><span className={`v-tag ${(rtd.CurMinB3 < 10) ? 'ok' : 'fail'}`}>{rtd.CurMinB3} mA</span></div>
                                    </div>
                                )}

								{/* Step 7: High Current Measurement - Branch #1 */}
                                {step.id === 7 && (
                                    <div className="voltage-visual">
                                        <div><span>Volatage</span><span className={`v-tag ${(rtd.VoltOnB1 > 22) ? 'ok' : 'fail'}`}>{rtd.VoltOnB1.toFixed(2)} V</span></div>
                                        <div><span>Current</span><span className={`v-tag ${(rtd.CurHiB1 > 3000) ? 'ok' : 'fail'}`}>{rtd.CurHiB1} mA</span></div>
                                    </div>
                                )}

								{/* Step 8: High Current Measurement - Branch #2 */}
                                {step.id === 8 && (
                                    <div className="voltage-visual">
                                        <div><span>Volatage</span><span className={`v-tag ${(rtd.VoltOnB2 > 22) ? 'ok' : 'fail'}`}>{rtd.VoltOnB2.toFixed(2)} V</span></div>
                                        <div><span>Current</span><span className={`v-tag ${(rtd.CurHiB2 > 3000) ? 'ok' : 'fail'}`}>{rtd.CurHiB2} mA</span></div>
                                    </div>
                                )}

								{/* Step 8: High Current Measurement - Branch #3 */}
                                {step.id === 9 && (
                                    <div className="voltage-visual">
                                        <div><span>Volatage</span><span className={`v-tag ${(rtd.VoltOnB3 > 22) ? 'ok' : 'fail'}`}>{rtd.VoltOnB3.toFixed(2)} V</span></div>
                                        <div><span>Current</span><span className={`v-tag ${(rtd.CurHiB3 > 3000) ? 'ok' : 'fail'}`}>{rtd.CurHiB3} mA</span></div>
                                    </div>
                                )}

								{/* Step 13: Terminating Resistor - Port #1 */}
                                {step.id === 13 && (
                                    <div className="voltage-visual">
                                        <div className={`led-light ${termRes & 1 ? 'on' : ''}`}></div>
                                    </div>
                                )}
                            </div>

                            <div className="step-action-col">
                                {isActive && step.type === 'manual' && (
                                    <button className="compact-ok-btn" onClick={(e) => {
										e.stopPropagation(); // Zastaví bublání na řádku (jumpToStep se nespustí)
										handleNext();
									}}>NEXT</button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default TestInterface;