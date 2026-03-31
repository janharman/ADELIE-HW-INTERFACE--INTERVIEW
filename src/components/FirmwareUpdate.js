import React, { useState, useRef } from 'react';
import './FirmwareUpdate.css';

const FirmwareUpdate = ({ serialRef }) => {
	const [file, setFile] = useState(null);
	const [uploading, setUploading] = useState(false);
	const [progress, setProgress] = useState(0);
	const [log, setLog] = useState([]);
	const abortController = useRef(false);

	const addLog = (msg) => {
		setLog(prev => [`${new Date().toLocaleTimeString()}: ${msg}`, ...prev].slice(0, 50));
	};

	const handleFileChange = (e) => {
		const selectedFile = e.target.files[0];
		if (selectedFile) {
			setFile(selectedFile);
			addLog(`Soubor vybrán: ${selectedFile.name} (${selectedFile.size} bytů)`);
		}
	};

	const startUpdate = async () => {
		if (!file || !serialRef.current) return;
		
		setUploading(true);
		setProgress(0);
		abortController.current = false;
		addLog("Startování update sekvence...");

		try {
			const reader = new FileReader();
			reader.onload = async (e) => {
				const buffer = new Uint8Array(e.target.result);
				const blockSize = 64; // Velikost bloku, kterou budeme ladit
				const totalBlocks = Math.ceil(buffer.length / blockSize);

				// 1. KROK: Handshake / Enter Bootloader
				addLog("Posílám požadavek na Bootloader...");
				// await serialRef.current.sendAndReceive([0xAA, 0xBB, ...]);

				for (let i = 0; i < totalBlocks; i++) {
					if (abortController.current) throw new Error("Update přerušen uživatelem");

					const start = i * blockSize;
					const end = Math.min(start + blockSize, buffer.length);
					const chunk = buffer.slice(start, end);

					// 2. KROK: Odeslání bloku
					// Tady budeme ladit tvůj protokol (Adresa + Data + Checksum)
					// const response = await serialRef.current.sendAndReceive(chunk);
					
					// Simulace pro teď:
					await new Promise(r => setTimeout(r, 50)); 
					
					setProgress(Math.round(((i + 1) / totalBlocks) * 100));
				}

				addLog("Update úspěšně dokončen!");
			};
			reader.readAsArrayBuffer(file);
		} catch (err) {
			addLog(`CHYBA: ${err.message}`);
		} finally {
			setUploading(false);
		}
	};

	return (
		<div className="fw-update-container">
			<h3>Firmware Update Module</h3>
			
			<div className="fw-upload-zone">
				<input type="file" id="fw-file" onChange={handleFileChange} disabled={uploading} />
				<label htmlFor="fw-file" className="fw-select-btn">
					{file ? file.name : "Vybrat .bin soubor"}
				</label>
				
				<button 
					className="fw-start-btn" 
					onClick={startUpdate} 
					disabled={!file || uploading}
				>
					{uploading ? "AKTUALIZUJI..." : "FLASH FIRMWARE"}
				</button>
			</div>

			{uploading && (
				<div className="fw-progress-area">
					<div className="fw-progress-bar">
						<div className="fw-progress-fill" style={{ width: `${progress}%` }}></div>
					</div>
					<span className="fw-progress-text">{progress}%</span>
				</div>
			)}

			<div className="fw-debug-log">
				<div className="log-header">Debug Log:</div>
				<div className="log-content">
					{log.map((entry, i) => <div key={i}>{entry}</div>)}
				</div>
			</div>
		</div>
	);
};

export default FirmwareUpdate;