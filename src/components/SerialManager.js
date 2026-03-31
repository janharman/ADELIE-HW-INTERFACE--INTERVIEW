import React, { useState, useImperativeHandle, forwardRef, useRef, useEffect } from 'react';
import './SerialManager.css';

const SerialManager = forwardRef((props, ref) => {
	const [status, setStatus] = useState('Disconnected');
	const portRef = useRef(null);
	const readerRef = useRef(null);
	const keepReading = useRef(false); 
	const incomingBuffer = useRef([]);
	
	const STORAGE_KEY = 'last_used_serial_port_index';

	const disconnect = async () => {
		if (!portRef.current) return;
		setStatus('Disconnecting...');
		keepReading.current = false;

		if (readerRef.current) {
			try {
				await readerRef.current.cancel(); 
			} catch (e) {
				console.error("Reader cancel error:", e);
			}
		}

		await new Promise(resolve => setTimeout(resolve, 50));

		try {
			if (portRef.current) {
				await portRef.current.close();
			}
		} catch (e) {
			console.error("Port close error:", e);
		}

		portRef.current = null;
		readerRef.current = null;
		setStatus('Disconnected');
	};

	const readLoop = async (port) => {
		keepReading.current = true;
		while (port.readable && keepReading.current) {
			readerRef.current = port.readable.getReader();
			try {
				while (keepReading.current) {
					const { value, done } = await readerRef.current.read();
					if (done || !keepReading.current) break;
					incomingBuffer.current.push(...value);
				}
			} catch (err) {
				console.warn("Read stream error:", err);
			} finally {
				if (readerRef.current) {
					readerRef.current.releaseLock();
					readerRef.current = null;
				}
			}
		}
	};

	const initializePort = async (port, index) => {
		try {
			if (portRef.current) await disconnect();
			await port.open({ 
				baudRate: 115200, 
				stopBits: 2,
				dataBits: 8,
				parity: 'none',
				flowControl: 'none'
			});
			portRef.current = port;
			localStorage.setItem(STORAGE_KEY, index.toString());
			setStatus(`Connected (Port #${index + 1})`);
			readLoop(port);
			return true;
		} catch (err) {
			console.error("Failed to open port:", err);
			setStatus('Error Opening Port');
			return false;
		}
	};

	useEffect(() => {
		const autoConnect = async () => {
			if (!navigator.serial) return;
			const allowedPorts = await navigator.serial.getPorts();
			if (allowedPorts.length > 0) {
				const savedIndex = localStorage.getItem(STORAGE_KEY);
				const indexToOpen = savedIndex !== null ? parseInt(savedIndex, 10) : 0;
				if (allowedPorts[indexToOpen]) {
					await initializePort(allowedPorts[indexToOpen], indexToOpen);
				}
			}
		};
		autoConnect();
		return () => { disconnect(); };
	}, []);

	const connectManually = async () => {
		try {
			const port = await navigator.serial.requestPort();
			const allowedPorts = await navigator.serial.getPorts();
			const newIndex = allowedPorts.indexOf(port);
			await initializePort(port, newIndex !== -1 ? newIndex : 0);
		} catch (err) {}
	};

	useImperativeHandle(ref, () => ({
		async sendAndReceive(dataArray) {
			if (!portRef.current?.writable) throw new Error("Port not connected");
			incomingBuffer.current = [];
			const writer = portRef.current.writable.getWriter();
			await writer.write(new Uint8Array(dataArray));
			writer.releaseLock();
			await new Promise(r => setTimeout(r, 100));
			return [...incomingBuffer.current];
		},
		disconnect
	}));

	return (
		<div>
			<div className="status-badge-container">
				<div className={`status-badge ${status.includes('Connected') ? 'online' : 'offline'}`}>
					{status}
				</div>
			</div>
			
			<div className="serial-btn-row">
				<button className="btn-conn" onClick={connectManually}>
					{portRef.current ? '🔄 Change' : 'Connect Hardware'}
				</button>
				{portRef.current && (
					<button className="btn-disc" onClick={disconnect}>
						❌ Disconnect
					</button>
				)}
			</div>
		</div>
	);
});

export default SerialManager;