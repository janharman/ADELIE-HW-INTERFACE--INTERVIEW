import React, { useRef, useState, useEffect } from 'react';
import './App.css';
import logo from './assets/logo-ecogate.png';
import SerialManager from './components/SerialManager';
import TestInterface from './components/TestInterface';
import RuntimeData from './components/RuntimeData';
import FirmwareUpdate from './components/FirmwareUpdate';
import ControlPanel from './components/ControlPanel';

/**
 * Main application component.
 * Manages sequential polling with disconnect detection (5 failed attempts).
 */
function App() {
	const serialRef = useRef();
	const [lastResponse, setLastResponse] = useState([]);
	const [isPolling, setIsPolling] = useState(false);
	const isProcessing = useRef(false);
	const [activeTab, setActiveTab] = useState('Runtime Data');
	const [statusON, setStatusON] = useState(0);
	const [runtimeData, setRuntimeData] = useState([]);
	const [productInfo, setProductInfo] = useState({recver: 0, fw: 0, hw: 0, bl: 0,	info: ''});
	
	// Track handshake state and failed attempts
	const fwInfoFetched = useRef(false);
	const failedAttempts = useRef(0);
	const MAX_FAILED_ATTEMPTS = 5;

	const commandRtD = [0x36, 0x00, 0x00, 0x00, 0x36, 0x00, 0x00, 0x00];
	const commandFwI = [0x36, 0xFF, 0x00, 0x00, 0x36, 0xFF, 0x00, 0x00];

	// Polling Logic with Auto-Reconnect/Handshake
	useEffect(() => {
		let timer;

		const poll = async () => {
			if (!serialRef.current || isProcessing.current) return;
			
			try {
				isProcessing.current = true;
				
				// Select command based on handshake state
				const currentCmd = !fwInfoFetched.current ? commandFwI : commandRtD;
				const response = await serialRef.current.sendAndReceive(currentCmd);

				if (response && response.length > 0) {
					// SUCCESS: Reset failure counter
					failedAttempts.current = 0;
					setLastResponse(response);
					
					// If this was a successful FW info request, mark handshake as complete
					if (!fwInfoFetched.current && response[0] == 0xC6) {
						console.log("Handshake successful, switching to Runtime Data.");
						fwInfoFetched.current = true;
					}
				} else {
					// EMPTY RESPONSE: Treat as failure
					throw new Error("Empty response");
				}

			} catch (err) {
				failedAttempts.current++;
				console.warn(`Attempt failed (${failedAttempts.current}/${MAX_FAILED_ATTEMPTS})`);

				if (failedAttempts.current >= MAX_FAILED_ATTEMPTS) {
					console.error("Device considered disconnected. Handshake reset.");
					fwInfoFetched.current = false; // Force commandFwI on next success
					// Optional: setLastResponse([]) to clear UI on disconnect
				}
			} finally {
				isProcessing.current = false;
			}
		};

		if (isPolling) {
			poll();
			timer = setInterval(poll, 500);
		} else {
			// Cleanup state when user stops polling
			fwInfoFetched.current = false;
			failedAttempts.current = 0;
		}

		return () => { if (timer) clearInterval(timer); };
	}, [isPolling]);

	// Global response handler
	useEffect(() => {
		if (lastResponse.length >= 8) {
			if (lastResponse[0] == 0xC6) {
				switch (lastResponse[1]) {
					case 0x00: // Runtime Data
						setStatusON(lastResponse[8] + (lastResponse[9] << 8) + (lastResponse[10] << 16) + (lastResponse[11] << 24));
						setRuntimeData(lastResponse);
						break;
					case 0xFF: // Firmware Data Status
						console.log("Firmware data packet received");
						console.log(lastResponse);
						const byteData = lastResponse.slice(20); // Vezme vše od 20. bajtu dál
						const text = new TextDecoder().decode(new Uint8Array(byteData));
						// Pokud víš, že string je ukončen nulou (null-terminated), 
						// je dobré ho očistit:
						const buffer = new Uint8Array(lastResponse).buffer;
						const view = new DataView(buffer);
						let pinf = {
							recver: view.getUint32(4, true),
							fw: view.getUint32(8, true),
							hw: view.getUint32(12, true),
							bl: view.getUint32(16, true),
							info: text.split('\0')[0]
						};
						setProductInfo(pinf);
						console.log("Extracted string:", pinf);
						break;
					default:
						break;
				}
			} else if (lastResponse[0] == 0xC1) {
				console.log("System response:", lastResponse);
			}
		}
	}, [lastResponse]);

	/**
	 * Manual Command Handler
	 */
	const handleManualCommand = async (label, mask) => {
		if (!serialRef.current) return;
		try {
			isProcessing.current = true; 
			let outD = [0x02005231, 0, 0, 0];
			if (mask & statusON) outD[2] = mask; else outD[1] = mask;
			outD[3] = outD[0] ^ outD[1] ^ outD[2];

			let hexArray = [];
			for (let d = 0; d < 4; d++) {
				let x = outD[d];
				for (let i = 0; i < 4; i++) {
					hexArray.push(x & 0xFF);
					x >>= 8;
				}
			}
			const response = await serialRef.current.sendAndReceive(hexArray);			
			setLastResponse(response);
		} catch (err) {
			console.error(`Manual command ${label} failed:`, err);
		} finally {
			isProcessing.current = false;
		}
	};

	return (
		<div className="app-container">
			<header className="app-main-header">
				<div className="header-content">
					<div className="logo-container">
						<div className="logo-wrapper">
							<img src={logo} alt="Ecogate" className="company-logo" />
						</div>
					</div>
					<h1>greenBOX Interface Test & Status</h1>
					<div className="header-spacer"></div>
				</div>
			</header>
			
			<main className="main-dashboard-grid">
				<aside className="left-panel">
					<section className="panel-section">
						<div className="section-header-with-icon">
							<h2 className="section-title">Connection & Polling</h2>
						</div>
						<div className="comm-group">
							<SerialManager ref={serialRef} />
							<button 
								className='button-start-comm'
								onClick={() => setIsPolling(!isPolling)}
								style={{ backgroundColor: isPolling ? '#cc0000' : '#008800' }}
							>
								{isPolling ? '⏹️ STOP READING' : '▶️ START READING'}
							</button>
						</div>
					</section>

					<section className="panel-section">
						<h2 className="section-title">
							Raw data <span className="data-len-tag">{lastResponse.length} bytes</span>
						</h2>
						<div className='div-raw-rec-data-container'>
							{lastResponse.length > 0 ? (
								Array.from({ length: Math.ceil(lastResponse.length / 16) }, (_, i) =>
									lastResponse.slice(i * 16, i * 16 + 16)
								).map((row, rowIndex) => (
									<div key={rowIndex} className="hex-row">
										<span className="hex-offset">{(rowIndex * 16).toString(16).toUpperCase().padStart(4, '0')}: </span>
										{row.map((b, byteIndex) => (
											<span key={byteIndex} className="hex-byte">
												{b.toString(16).toUpperCase().padStart(2, '0')}
											</span>
										))}
									</div>
								))
							) : (
								<div className="no-data-msg">--- NO DATA RECEIVED ---</div>
							)}
						</div>
					</section>

					<section className="panel-section">
						<h2 className="section-title">Control panel</h2>
						<ControlPanel onCommand={handleManualCommand} statusON={statusON} />
					</section>
				</aside>

				<section className="right-panel">
					<div className="tab-bar">
						{['Runtime Data', 'Firmware Update', 'Test Interface'].map(tab => (
							<button 
								key={tab}
								className={activeTab === tab ? 'tab-btn active' : 'tab-btn'} 
								onClick={() => setActiveTab(tab)}
							>
								{tab}
							</button>
						))}
					</div>

					<div className="tab-container">
						{activeTab === 'Runtime Data' && <RuntimeData data={runtimeData} pinf={productInfo} />}
						{activeTab === 'Firmware Update' && <FirmwareUpdate />}
						{activeTab === 'Test Interface' && <TestInterface />}
					</div>
				</section>
			</main>

			<footer className="app-footer">
				greenBOX Interface v1.0 | Ecogate Inc.
			</footer>
		</div>
	);
}

export default App;