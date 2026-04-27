import React, { useEffect, useState } from 'react';
import './RuntimeData.css'
import RtdBranch from './RtdBranch';

function RuntimeData({ data, pinf }) {
	const [statusIN, setStatusIN] = useState(0);
	const [statusON, setStatusON] = useState(0);
	const [statusOK, setStatusOK] = useState(0);
	const [sysStatus, setSysStatus] = useState(0);
	const [branch, setBranch] = useState([]);

	const stsInMask = [1, 2, 4, 8];
	
	const onConfig = [
		{ gap: 0, msk: 0x01, txt: 'Relay #1', cls: 'sts-led-relay' },
		{ gap: 0, msk: 0x02, txt: 'Relay #2', cls: 'sts-led-relay' },
		{ gap: 0, msk: 0x04, txt: 'Relay #3', cls: 'sts-led-relay' },
		{ gap: 1, msk: 0x08, txt: 'Relay #4', cls: 'sts-led-relay' },
		{ gap: 0, msk: 0x100, txt: 'Branch #1', cls: 'sts-led-branch' },
		{ gap: 0, msk: 0x200, txt: 'Branch #2', cls: 'sts-led-branch' },
		{ gap: 1, msk: 0x400, txt: 'Branch #3', cls: 'sts-led-branch' },
		{ gap: 0, msk: 0x10000, txt: 'Semaph RD', cls: 'sts-led-red' },
		{ gap: 0, msk: 0x20000, txt: 'Semaph OR', cls: 'sts-led-orange' },
		{ gap: 0, msk: 0x40000, txt: 'Semaph GR', cls: 'sts-led-green' },
		{ gap: 0, msk: 0x80000, txt: 'Semaph BU', cls: 'sts-led-blue' }
	];

	const okConfig = [
		{ gap: 0, msk: 0x01, txt: 'Branch Volt #1 OK', cls: 'sts-led-branch' },
		{ gap: 0, msk: 0x02, txt: 'Branch Volt #2 OK', cls: 'sts-led-branch' },
		{ gap: 1, msk: 0x04, txt: 'Branch Volt #3 OK', cls: 'sts-led-branch' },
		{ gap: 0, msk: 0x100, txt: 'Branch Current #1 OK', cls: 'sts-led-yellow' },
		{ gap: 0, msk: 0x200, txt: 'Branch Current #2 OK', cls: 'sts-led-yellow' },
		{ gap: 1, msk: 0x400, txt: 'Branch Current #3 OK', cls: 'sts-led-yellow' },
		{ gap: 0, msk: 0x10000, txt: 'On Board PSU 24 VDC OK', cls: 'sts-led-blue' },
		{ gap: 0, msk: 0x20000, txt: 'On Board PSU 5 VDC OK', cls: 'sts-led-blue' },
		{ gap: 0, msk: 0x40000, txt: 'On Board PSU 19 VDC OK', cls: 'sts-led-blue' },
		{ gap: 0, msk: 0x1000000, txt: 'Power OK #1', cls: 'sts-led-orange' },
		{ gap: 0, msk: 0x2000000, txt: 'Power OK #2', cls: 'sts-led-orange' },
		{ gap: 0, msk: 0x10000000, txt: 'PC Communication OK', cls: 'sts-led-yellow' }
	];

	useEffect(() => {
		if (!data || data.length < 75) return;

		setStatusIN(data[4]);
		setStatusON(data[8] + (data[9] << 8) + (data[10] << 16) + (data[11] << 24));
		setStatusOK(data[12] + (data[13] << 8) + (data[14] << 16) + (data[15] << 24));
		setSysStatus(data[72] + (data[73] << 8));

		let brA = [];
		for (let x=0; x<3; x++) {
			let i = 16 + (x * 4);
			let y = 48 + (x * 4);
			brA.push({
				currmA: data[i] + (data[i+1] << 8) + (data[i+2] << 16) + (data[i+3] << 24),
				voltOk: ((data[12] & (1 << x)) > 0),
				currOk: ((data[13] & (1 << x)) > 0),
				powerOn: ((data[9] & (1 << x)) > 0),
				voltmV: data[y+0] + (data[y+1] << 8) + (data[y+2] << 16) + (data[y+3] << 24),
				limitmA: data[60+x*4] + (data[61+x*4] << 8),
				timeoutMS: data[62+x*4] + (data[63+x*4] << 8)
			});
		}
		setBranch(brA);
	}, [data]);

	return (
		<div className="rtd-main-wrapper">
			<div className='rtd-container-div'>
				{/* 1. SLOUPEC: Digi In */}
				<div className='rtd-sts-div'>
					{stsInMask.map((mask, idx) => (
						<div key={idx} className={`sts-led-digi-in ${(statusIN & mask)? 'sts-led-on-y': 'sts-led-of-y'}`}>Digi In #{idx+1}</div>
					))}
				</div>

				{/* 2. SLOUPEC: Relays & Branches ON */}
				<div className='rtd-sts-div'>
					{onConfig.map((item, idx) => (
						<div key={idx} className={`sts-led-digi-in ${item.cls} ${(statusON & item.msk)? '': 'sts-led-off'}`} style={{ marginBottom: (item.gap)? '12px' : '0' }}>
							{item.txt}
						</div>
					))}
				</div>

				{/* 3. SLOUPEC: Status OK */}
				<div className='rtd-sts-div'>
					{okConfig.map((item, idx) => (
						<div key={idx} className={`sts-led-digi-in ${item.cls} ${(statusOK & item.msk)? '': 'sts-led-off'}`} style={{ marginBottom: (item.gap)? '12px' : '0' }}>
							{item.txt}
						</div>
					))}
				</div>

				{/* BRANCH DETAIL LIST */}
				<div className='rtd-sts-div'>
					{branch.map((item, idx) => (
						<div key={idx}><RtdBranch data={item} id={idx+1} /></div>
					))}
				</div>
			</div>

			<div className="rtd-separator"></div>
			<div>
				<div className="rtd-details-grid">
					<div className="rtd-details-group" style={{ flex: 1 }}>
						<h4>SYSTEM, Power & Thermal Measurements</h4>
						<div className="analog-grid">
							{/* Sloupec 1: SYSTEM LEDs */}
							<div className='rtd-sts-div'>
								<div className={`sts-led-digi-in ${(sysStatus & (1 << 0)) ? 'sts-led-green' : 'sts-led-off'}`}>LED OK</div>
								<div className={`sts-led-digi-in ${(sysStatus & (1 << 1)) ? 'sts-led-yellow' : 'sts-led-off'}`}>LED WARN</div>
								<div className={`sts-led-digi-in ${(sysStatus & (1 << 2)) ? 'sts-led-red' : 'sts-led-off'}`}>LED ERR</div>
							</div>

							{/* Sloupec 2: Temp & Trigger */}
							<div>
								<div className="analog-item rail-mcu-temp">
									<span className="label">MCU Temp:</span>
									<span className="value">{((data[36] + (data[37] << 8)) / 10).toFixed(1)}°C</span>
								</div>
								<div className="analog-item rail-fan-temp">
									<span className="label">Fan Trigger:</span>
									<span className="value">{((data[38] + (data[39] << 8)) / 10).toFixed(1)}°C</span>
								</div>
							</div>

							{/* Sloupec 3: COOLING */}
							<div className='rtd-sts-div'>
								<div className={`sts-led-digi-in ${(sysStatus & (1 << 8)) ? 'sts-led-fan-on' : 'sts-led-off'}`}>Cooling Fan ON</div>
								<div style={{ display: 'flex', gap: '4px', margin: '3px' }}>
									<div className={`sts-led-digi-in ${(sysStatus & (1 << 8))?((sysStatus & (1 << 10)) ? 'sts-led-green' : 'sts-led-red'):'sts-led-gray'}`} style={{ flex: 1, margin: 0, textAlign: 'center', padding: '6px 2px' }}>
										<span className="fan-icon">↻ </span>#1
									</div>
									<div className={`sts-led-digi-in ${(sysStatus & (1 << 8))?((sysStatus & (1 << 11)) ? 'sts-led-green' : 'sts-led-red'):'sts-led-gray'}`} style={{ flex: 1, margin: 0, textAlign: 'center', padding: '6px 2px' }}>
										<span className="fan-icon">↻ </span>#2
									</div>
								</div>								
								<div className={`sts-led-digi-in ${(sysStatus & (1 << 9)) ? 'sts-led-red' : 'sts-led-off'}`}>
									{(sysStatus & (1 << 9)) ? '⚠️ OVERTEMP' : 'Temp OK'}
								</div>
							</div>

							{/* Sloupec 4: 24V & 5V */}
							<div>
								<div className="analog-item rail-24v">
									<span className="label">Main 24VDC:</span>
									<span className="value">{((data[28] + (data[29] << 8)) / 1000).toFixed(2)}V</span>
								</div>
								<div className="analog-item rail-5v">
									<span className="label">On Board 5VDC:</span>
									<span className="value">{((data[32] + (data[33] << 8)) / 1000).toFixed(2)}V</span>
								</div>
							</div>

							{/* Sloupec 5: PD & 19V */}
							<div>
								<div className="analog-item rail-pd">
									<span className="label">PD Voltage:</span>
									<span className="value">{((data[30] + (data[31] << 8)) / 1000).toFixed(2)}V</span>
								</div>
								<div className="analog-item rail-19v">
									<span className="label">19 VDC output:</span>
									<span className="value">{((data[34] + (data[35] << 8)) / 1000).toFixed(2)}V</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div className="rtd-separator"></div>
			<div>
				<h5 className='rtd-fw-info'>{pinf.info.replaceAll('\n', '; ')}</h5>
			</div>
		</div>
	);
}

export default RuntimeData;