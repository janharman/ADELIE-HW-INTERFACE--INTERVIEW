import React, { useRef, useState, useEffect } from 'react';
import './App.css';
import logo from './assets/logo-ecogate.png';
import SerialManager from './components/SerialManager';
import TestInterface from './components/TestInterface';
import RuntimeData from './components/RuntimeData';
import FirmwareUpdate from './components/FwUpdate';
import ControlPanel from './components/ControlPanel';
import OperationalData from './components/OperationalData';

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
	const [productInfo, setProductInfo] = useState({recver: 0, fw: 0, hw: 0, bl: 0,	info: '---'});
	const [isConnected, setIsConnected] = useState(true);
	const [bootloaderInfo, setBootloaderInfo] = useState({ver: 0, date: 0, sts: 0});
	const silenceUntil = useRef(0);
	const commandQueue = useRef(Promise.resolve());
	const queueLength = useRef(0);
	
	// Track handshake state and failed attempts
	const fetchCommand = useRef(0);	// 0 = fetch Fw Info; 1 = fetch Runtime Data; 2 = fetch Bootloader Info
	const failedAttempts = useRef(0);
	const MAX_FAILED_ATTEMPTS = 5;

	const switchCommand = () => {
		switch (activeTab)
		{
			case 'Runtime Data':
				fetchCommand.current = 1;
				break;
			case 'Firmware Update':
				fetchCommand.current = 2;
				break;
			case 'Test Interface':
				fetchCommand.current = 1;
				break;
			case 'Operational Data':
				fetchCommand.current = 1;
				break;
		}
	}

	const resetCommState = () => {
		setBootloaderInfo({ver: 0, date: 0, sts: 0});
		fetchCommand.current = 0; // Force commandFwI on next success
	}

	// Polling Logic with Auto-Reconnect/Handshake
	useEffect(() => {
		let timer;

		const poll = async () => {
			if (!serialRef.current) return;
			if (silenceUntil.current > Date.now()) return;
			if (queueLength.current > 3) return;
			// Místo přímého volání serialRef, pošleme požadavek do fronty
			let cmdLabel = "Polling Data";
			let reg = 0;
			switch (fetchCommand.current) {
				case 0: reg = 0xFF; cmdLabel = "Fetch FW Info"; break;
				case 1: reg = 0x00; cmdLabel = "Fetch Runtime"; break;
				case 2: reg = 0xB1; cmdLabel = "Fetch Bootloader"; break;
			}

			// handleManualCommand se postará o to, aby se to nepopralo s kliknutím na relé
			handleManualCommand(cmdLabel, reg, 0, null, true);
		};

		if (isPolling) {
			poll();
			timer = setInterval(poll, 450);
		} else {
			// Cleanup state when user stops polling
			resetCommState();
			failedAttempts.current = 0;
		}

		return () => { if (timer) clearInterval(timer); };
	}, [isPolling]);

	// Global response handler
	useEffect(() => {
		if (lastResponse.length >= 8) {
			if (lastResponse[0] === 0xC6) {
				switch (lastResponse[1]) {
					case 0x00: // Runtime Data
						setStatusON(lastResponse[8] + (lastResponse[9] << 8) + (lastResponse[10] << 16) + (lastResponse[11] << 24));
						setRuntimeData(lastResponse);
						break;
					case 0xB1: // Bootloader Info
						const bli = {
							ver: lastResponse[4], 
							date: lastResponse[8] + (lastResponse[9] << 8) + (lastResponse[10] << 16) + (lastResponse[11] << 24),
							sts: lastResponse[12]
						};
						setBootloaderInfo(bli);
						break;
					case 0xFF: // Firmware Data Status
						console.log("Firmware info packet received");
						const byteData = lastResponse.slice(20); // Vezme vše od 20. bajtu dál
						const text = new TextDecoder().decode(new Uint8Array(byteData));
						// Pokud víš, že string je ukončen nulou (null-terminated), 
						// je dobré ho očistit:
						const buffer = new Uint8Array(lastResponse).buffer;
						const view = new DataView(buffer);
				        let di = text.indexOf('Date:');
						let pinf = {
							recver: view.getUint32(4, true),
							fw: view.getUint32(8, true).toString().toUpperCase(),
							hw: view.getUint32(12, true).toString(16).toUpperCase(),
							bl: view.getUint32(16, true),
				            date: di > -1 ? text.slice(di + 6, di + 12) : '--',
							info: text.split('\0')[0].replaceAll("\\n", "\n")
						};
						setProductInfo(pinf);
						switchCommand();
						break;
					default:
						break;
				}
			} else if (lastResponse[0] === 0xC1) {
				console.log("System response:", lastResponse);
			}
		}
	}, [lastResponse]);

	/**
	 * Manual Command Handler + Flashing
	 */
	const handleManualCommand = async (label, regType, mask, dataPayload=null) => {
		if (!serialRef.current)
		{
			console.log(label + ' ---> Cannot be performed. Serial port failed.');
			return;
		}
		queueLength.current++;
		// if (isProcessing.current) {
		// 	console.warn(`Command ${label} ignored - Serial port busy`);
		// 	return null;
		// }

		// "Nabalíme" nový příkaz na konec stávající fronty
    	const currentPromise = commandQueue.current
			.catch(() => {})
			.then(async () => {
				try {
					console.log(label);
					isProcessing.current = true;
					let outD = [];

					switch (regType)
					{
					case 0x52:	// Control Command
						outD = [0x02005231, 0, 0, 0];
						if (!dataPayload)
							if (mask & statusON) outD[2] = mask; else outD[1] = mask;
						else {
							outD[1] = mask;
							outD[2] = dataPayload[0];
						}
						break;
					case 0x53:	// Operational Data
						outD = [0x01055331, mask, 0];
						break;
					case 0xB0:	// Reset / Bootloader
						outD = [0x0100B031, mask, 0]; // 3. prvek je místo pro CRC
						break;

					case 0xB1:	// Bootloader Info
						outD = [0x0000B136, 0];
						break;

					case 0xBE: // FLASH info: number of Chunks
						outD = [
							0x0000BE31, // Command + Register + (Address >> 4)
							mask,		// Number of chunks
							0,			// Reserve - set to zero
							0           // Místo pro výsledné CRC na konci
						];
						silenceUntil.current = Date.now() + 2000;
						break;

					case 0xBF: // FLASH FIRMWARE (256 Bytes)
						// dataPayload je Uint8Array (256 bytes) -> převedeme na 64 Uint32 prvků
						const data32 = new Uint32Array(dataPayload.buffer);				
						outD = [
							0x0000BF31 + ((mask >> 8) << 16), // Command + Register + (Address >> 4)
							...Array.from(data32), // Celý payload v uint32
							0           // Místo pro výsledné CRC na konci
						];
						silenceUntil.current = Date.now() + 2000;
						break;
					
					case 0xFF: // Firmware Data - info
						outD = [0x0000FF36, 0];
						break;

					default: // Runtime Data
						outD = [0x00000036, 0];
						break;
					}
					let cnt = outD.length;

					// 2. Výpočet CRC z celého pole (vše kromě posledního prvku)
					let crc = 0;
					for (let d = 0; d < (cnt - 1); d++) {
						crc ^= outD[d];
					}
					outD[cnt - 1] = crc; // Uložení CRC na konec pole

					// 3. Rozházení 32-bit uintů do 8-bit hexArray (Little Endian)
					let hexArray = [];
					for (let d = 0; d < cnt; d++) {
						let x = outD[d];
						hexArray.push(x & 0xFF);
						hexArray.push((x >> 8) & 0xFF);
						hexArray.push((x >> 16) & 0xFF);
						hexArray.push((x >> 24) & 0xFF);
					}

					// 4. Odeslání a návrat odpovědi
					const response = await serialRef.current.sendAndReceive(hexArray);
					setLastResponse(response);

					// Malá prodleva mezi příkazy, aby se Serial port "nadechl"
					await new Promise(resolve => setTimeout(resolve, 30));			

					return response;
				} catch (err) {
					console.error(`Queued Command ${label} failed:`, err);
				} finally {
					isProcessing.current = false;
					queueLength.current--;
				}	
			});
		commandQueue.current = currentPromise;
		return currentPromise;
	};

	useEffect(() => {
		if (!fetchCommand.current) return;
		if (activeTab === 'Test Interface') setIsPolling(true);
		switchCommand();
	}, [activeTab])

	const handleConnectionChange = (connected) => {
		if (!connected) {
			setIsPolling(false);
			resetCommState();
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
							<SerialManager ref={serialRef} onConnectionChange={handleConnectionChange}/>
							{isConnected?(
							<button 
								className='button-start-comm'
								onClick={() => setIsPolling(!isPolling)}
								style={{ backgroundColor: isPolling ? '#cc0000' : '#008800' }}
							>
								{isPolling ? '⏹️ STOP READING' : '▶️ START READING'}
							</button>
							):(
							<button></button>)}
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
						{['Runtime Data', 'Firmware Update', 'Test Interface', 'Operational Data'].map(tab => (
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
						{activeTab === 'Firmware Update' && <FirmwareUpdate blInfo={bootloaderInfo} productInfo={productInfo} onCommand={handleManualCommand}/>}
						{activeTab === 'Test Interface' && <TestInterface isConnected={isConnected} onCommand={handleManualCommand} runtimeData={runtimeData}/>}
						{activeTab === 'Operational Data' && <OperationalData />}
					</div>
				</section>
			</main>

			<footer className="app-footer">
				greenBOX Interface v1.0 | Ecogate Inc. @{__BUILD_DATE__}
			</footer>
		</div>
	);
}

export default App;