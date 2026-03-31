import React from 'react';
import './RtdBranch.css';

/**
 * Component representing a single power branch row with 
 * voltage, current, and limit configuration.
 */
const RtdBranch = ({ data, id }) => {
	const MAX_CURRENT_MA = 5000; 
	const currentPercent = Math.min(100, Math.max(0, (data.currmA / MAX_CURRENT_MA) * 100));
	
	// Calculate current limit marker position on the gauge
	const limitPercent = Math.min(100, (data.limitmA / MAX_CURRENT_MA) * 100);
	
	const barClass = data.currOk ? 'gauge-ok' : 'gauge-error';
	const containerClass = `rtd-branch-row ${data.powerOn ? '' : 'branch-off'}`;

	return (
		<div className={containerClass}>
			{/* COLUMN 1: STATUS & ID */}
			<div className="branch-col-info">
				<div className="branch-id">BR #{id}</div>
				<div className={`status-dot ${data.powerOn ? 'dot-on' : 'dot-off'}`}></div>
				<div className="pwr-label">{data.powerOn ? 'ACTIVE' : 'OFF'}</div>
			</div>

			{/* COLUMN 2: VOLTAGE */}
			<div className="branch-col-volt">
				<div className="unit-label">VOLTAGE</div>
				<div className="volt-display-box">
					<div className="value-num-wrapper">
						<strong>{(data.voltmV / 1000).toFixed(1)}</strong>
						<span className="v-unit">V</span>
					</div>
					<div className={`volt-status-tag ${data.voltOk ? 'v-ok' : 'v-err'}`}>
						{data.voltOk ? 'STABLE' : 'LOW'}
					</div>
				</div>
			</div>

			{/* COLUMN 3: CURRENT (Vertical Block) */}
			<div className="branch-col-current">
				<div className="current-data-block">
					<div className="unit-label">CURRENT</div>
					<div className="curr-value-alignment-wrapper">
						<div className={`curr-value-wrapper ${!data.currOk ? 'text-err' : ''}`}>
							<span className="curr-num">{data.currmA}</span>
							<span className="curr-unit">mA</span>
						</div>
					</div>
				</div>

				<div className="gauge-container">
					<div className="gauge-track">
						<div 
							className={`gauge-bar ${barClass}`} 
							style={{ width: `${currentPercent}%` }}
						/>
						{/* Visual limit marker (threshold) */}
						<div 
							className="gauge-limit-marker" 
							style={{ left: `${limitPercent}%` }}
						></div>
					</div>
				</div>

				{/* LIMITS FOOTER (Below gauge) */}
				<div className="branch-limits-footer">
					<div className="limit-item">
						<span className="limit-label">Threshold:</span>
						<span className="limit-val">{data.limitmA} mA</span>
					</div>
					<div className="limit-separator">|</div>
					<div className="limit-item">
						<span className="limit-label">Timeout:</span>
						<span className="limit-val">{data.timeoutMS} s</span>
					</div>
				</div>
			</div>
		</div>
	);
};

export default RtdBranch;