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
	const commandDelay = useRef(0);
	const [serialNumber, setSerialNumber] = useState('');
	const [comment, setComment] = useState('');
	const prevStep = useRef(-1);
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
		FanRotation: 0,
		PowerOK: 0,
		PD_5V: 0,
		PD_9V: 0,
		PD_12V: 0,
		PD_15V: 0,
		PD_20V: 0,
		PD_ALL_OK: 0,
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
		{ id: 14, label: 'Terminating Resistor Port #2', type: 'manual' },
		{ id: 15, label: 'Terminating Resistor Port #3', type: 'manual' },
		{ id: 16, label: 'Fan Rotation #1 + #2', type: 'auto' },
		{ id: 17, label: 'Power OK #1 + #2', type: 'auto' },
		{ id: 18, label: 'PD Port', type: 'auto' },
		{ id: 19, label: 'Visual: Display + Button', type: 'manual' },
		{ id: 20, label: 'Visual: Data LEDs + 24VDC LEDs', type: 'manual' },
		{ id: 21, label: 'Visual: ERROR + WARNING + OK LEDs', type: 'manual' },
		{ id: 22, label: 'Serial Number', type: 'manual' },
		{ id: 23, label: 'Comment', type: 'manual' },
		{ id: 24, label: 'Save Report to Database', type: 'manual' },
    ];

    const turnOffAll = () => {
        // Turn off Semaphore LEDs (bits 16-19) and Relays (assuming bits 20-23)
        onCommand('All Outputs OFF', 0x52, 0, [0xFFFFFFFF]); 
    };

	// DEBUG: Jump to step
    const jumpToStep = (index) => {
		commandDelay.current = 0;
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
			if (currentStep === 15) {
				updated.FanRotation |= (d[72] + (d[73] << 8)) & 0xD00;
			}
			if (currentStep === 16) {
				updated.PowerOK |= updated.statusOk & 0x3000000;
			}
			if (currentStep === 17) {
				const volt = (d[30] + (d[31] << 8)) / 1000;
				if ((volt > 4.5) && (volt < 5.5)) {				// PD for 5V
					updated.PD_5V = volt;
					updated.PD_ALL_OK |= 1;
				}
				if ((volt > 8.5) && (volt < 9.5)) {				// PD for 9V
					updated.PD_9V = volt;
					updated.PD_ALL_OK |= 2;
				}
				if ((volt > 11) && (volt < 13)) {				// PD for 12V
					updated.PD_12V = volt;
					updated.PD_ALL_OK |= 4;
				}
				if ((volt > 14) && (volt < 16)) {				// PD for 15V
					updated.PD_15V = volt;
					updated.PD_ALL_OK |= 8;
				}
				if ((volt > 19) && (volt < 21)) {				// PD for 20V
					updated.PD_20V = volt;
					updated.PD_ALL_OK |= 16;
				}
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
		if (((currentStep < 12) || (currentStep > 14)) && terminatingResTimer.current)
		{
			clearInterval(terminatingResTimer.current);
			terminatingResTimer.current = null;
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
				if (commandDelay.current) {	commandDelay.current--;	break; }
				commandDelay.current = 5;
				onCommand('Branch #1', 0x52, 0x100, [0x600]);
				break;
			case 7:		// ----------------------------- High-Current Measurement - Branch #2
				if (commandDelay.current) {	commandDelay.current--;	break; }
				commandDelay.current = 5;
				onCommand('Branch #2', 0x52, 0x200, [0x500]);
				break;
			case 8:		// ----------------------------- High-Current Measurement - Branch #3
				if (commandDelay.current) {	commandDelay.current--;	break; }
				commandDelay.current = 5;
				onCommand('Branch #3', 0x52, 0x400, [0x300]);
				break;
			case 9:		// ----------------------------- Modbus Communication - Port #1
				if (commandDelay.current) {	commandDelay.current--;	break; }
				commandDelay.current = 5;
				onCommand('Branch #1', 0x52, 0x100, [0x600]);
				break;
			case 10:	// ----------------------------- Modbus Communication - Port #2
				if (commandDelay.current) {	commandDelay.current--;	break; }
				commandDelay.current = 5;
				onCommand('Branch #2', 0x52, 0x200, [0x500]);
				break;
			case 11:	// ----------------------------- Modbus Communication - Port #3
				if (commandDelay.current) {	commandDelay.current--;	break; }
				commandDelay.current = 5;
				onCommand('Branch #3', 0x52, 0x400, [0x300]);
				break;
			case 12:	// ----------------------------- Terminating Resistor - Port #1
			case 13:	// ----------------------------- Terminating Resistor - Port #2
			case 14:	// ----------------------------- Terminating Resistor - Port #3
				if ((prevStep.current === currentStep) && (terminatingResTimer.current)) return;
				if (terminatingResTimer.current) clearInterval(terminatingResTimer.current);
				const runTermRes = () => {
					setTermRes((prev) => {
						const tr = (prev === 0)?(1 << (currentStep - 12)): 0;
						onCommand(`Terminating Resistor Port #${currentStep - 11} - ${tr?'ON':'OFF'}`, 0x53, tr);
						return tr;
					});
				};
				runTermRes();
				terminatingResTimer.current = setInterval(runTermRes, 2000);				
				break;
			case 15:	// ----------------------------- Fan Rotation #1 + #2
				if ((rtd.FanRotation & 0xD00) === 0xD00)
					setTimeout(() => setCurrentStep(prev => (prev === 15 ? 16 : prev)), 1200);
				if (commandDelay.current) {	commandDelay.current--;	break; }
				commandDelay.current = 6;
				onCommand('FAN TEST', 0x52, 0x1000000);
				break;
			case 16:	// ----------------------------- Power OK #1 + #2
				if ((rtd.PowerOK & 0x3000000) === 0x3000000)
					setTimeout(() => setCurrentStep(prev => (prev === 16 ? 17 : prev)), 1200);
				break;
			case 17:	// ----------------------------- PD Port 5 12 19 V
				if ((rtd.PD_ALL_OK & 0x0005) === 0x005)
					setTimeout(() => setCurrentStep(prev => (prev === 17 ? 18 : prev)), 1200);
				break;
			case 20:	// ----------------------------- LEDs OK WARNING ERROR test
				if (prevStep.current === currentStep) return;
				onCommand('LEDs OK, WARNING and ERROR test', 0x52, 0x2000000);
				break;
		}
		prevStep.current = currentStep;
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
                                        <div><span>Voltage</span><span className={`v-tag ${(rtd.VoltOnB1 > 22) ? 'ok' : 'fail'}`}>{rtd.VoltOnB1.toFixed(2)} V</span></div>
                                        <div><span>Current</span><span className={`v-tag ${(rtd.CurHiB1 > 3000) ? 'ok' : 'fail'}`}>{rtd.CurHiB1} mA</span></div>
                                    </div>
                                )}

								{/* Step 8: High Current Measurement - Branch #2 */}
                                {step.id === 8 && (
                                    <div className="voltage-visual">
                                        <div><span>Voltage</span><span className={`v-tag ${(rtd.VoltOnB2 > 22) ? 'ok' : 'fail'}`}>{rtd.VoltOnB2.toFixed(2)} V</span></div>
                                        <div><span>Current</span><span className={`v-tag ${(rtd.CurHiB2 > 3000) ? 'ok' : 'fail'}`}>{rtd.CurHiB2} mA</span></div>
                                    </div>
                                )}

								{/* Step 8: High Current Measurement - Branch #3 */}
                                {step.id === 9 && (
                                    <div className="voltage-visual">
                                        <div><span>Voltage</span><span className={`v-tag ${(rtd.VoltOnB3 > 22) ? 'ok' : 'fail'}`}>{rtd.VoltOnB3.toFixed(2)} V</span></div>
                                        <div><span>Current</span><span className={`v-tag ${(rtd.CurHiB3 > 3000) ? 'ok' : 'fail'}`}>{rtd.CurHiB3} mA</span></div>
                                    </div>
                                )}

								{/* Step 13, 14, 15: Terminating Resistor - Port #1 */}
                                {(step.id === 13 || step.id === 14 || step.id === 15) && isActive && (
                                    <div className="voltage-visual">
                                        <div className={`led-light aqua ${termRes & (1 << (step.id-13)) ? 'on' : ''}`}>{termRes ? 'ON' : 'OFF'}</div>
                                    </div>
                                )}

								{/* Step 16: Fan Rotation #1 + #2 */}
                                {(step.id === 16) && isActive && (
                                    <div className="voltage-visual">
                                        <div className={`led-light aqua ${(rtd.FanRotation & 0x100) ? 'on' : ''}`}>{(rtd.FanRotation & 0x100) ? 'ON' : 'OFF'}</div>
                                        <div className={`led-light green ${(rtd.FanRotation & 0x400) ? 'on' : ''}`}>{(rtd.FanRotation & 0x400) ? 'ON' : 'OFF'}</div>
                                        <div className={`led-light green ${(rtd.FanRotation & 0x800) ? 'on' : ''}`}>{(rtd.FanRotation & 0x800) ? 'ON' : 'OFF'}</div>
                                    </div>
                                )}

								{/* Step 17: Power OK #1 + #2 */}
                                {(step.id === 17) && isActive && (
                                    <div className="voltage-visual">
                                        <div className={`led-light green ${(rtd.PowerOK & 0x1000000) ? 'on' : ''}`}>{(rtd.PowerOK & 0x1000000) ? 'ON' : 'OFF'}</div>
                                        <div className={`led-light green ${(rtd.PowerOK & 0x2000000) ? 'on' : ''}`}>{(rtd.PowerOK & 0x2000000) ? 'ON' : 'OFF'}</div>
                                    </div>
                                )}

								{/* Step 18: Power Delivery Port values 5 12 19 V */}
                                {step.id === 18 && (
                                    <div className="voltage-visual pdport">
                                        <div><span>5V</span><span className={`v-tag pdp ${(rtd.PD_ALL_OK & 1) ? 'ok' : 'fail'}`}>{rtd.PD_5V.toFixed(1)} V</span></div>
                                        <div><span>9V</span><span className={`v-tag pdp ${(rtd.PD_ALL_OK & 2) ? 'ok' : 'fail'}`}>{rtd.PD_9V.toFixed(1)} V</span></div>
                                        <div><span>12V</span><span className={`v-tag pdp ${(rtd.PD_ALL_OK & 4) ? 'ok' : 'fail'}`}>{rtd.PD_12V.toFixed(1)} V</span></div>
                                        <div><span>15V</span><span className={`v-tag pdp ${(rtd.PD_ALL_OK & 8) ? 'ok' : 'fail'}`}>{rtd.PD_15V.toFixed(1)} V</span></div>
                                        <div><span>20V</span><span className={`v-tag pdp ${(rtd.PD_ALL_OK & 16) ? 'ok' : 'fail'}`}>{rtd.PD_20V.toFixed(1)} V</span></div>
                                    </div>
                                )}

								{/* Step 22: Serial Number */}
                                {step.id === 22 && (
									<div className="voltage-visual">
										<div>
											{serialNumber && <span className="serial-preview">S/N: {serialNumber}</span>}
											<input type="number" className="serial-input"	placeholder="Enter S/N"	value={serialNumber}
												onChange={(e) => setSerialNumber(e.target.value)}
												onKeyDown={(e) => {
													if (e.key === 'Enter' && serialNumber.length > 0) {
														handleNext(); // Potvrzení Enterem
													}
												}}
											/>
										</div>
									</div>
								)}

								{/* Step 23: Serial Number */}
                                {step.id === 23 && (
									<div className="voltage-visual">
										<input type="text" className="serial-input"	placeholder="Enter comment"	value={comment}
											onChange={(e) => setComment(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === 'Enter') handleNext();
											}}
										/>
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