import React from 'react';
import './ControlPanel.css';

const ControlPanel = ({ onCommand, statusON }) => {
	
	// Pomocná funkce pro kontrolu stavu proti masce
	const isActive = (mask) => (statusON & mask) !== 0;

	return (
		<div className="control-groups-container">
			{/* ŘADA 1: RELÉ (Masky 0x01, 0x02, 0x04, 0x08) */}
			<div className="control-sub-row">
				<div className="control-label">RELAYS</div>
				<div className="control-grid-4">
					<button className={`btn-ctrl rele ${isActive(0x01) ? 'active' : ''}`} onClick={() => onCommand('R1', 0x01)}>R1</button>
					<button className={`btn-ctrl rele ${isActive(0x02) ? 'active' : ''}`} onClick={() => onCommand('R2', 0x02)}>R2</button>
					<button className={`btn-ctrl rele ${isActive(0x04) ? 'active' : ''}`} onClick={() => onCommand('R3', 0x04)}>R3</button>
					<button className={`btn-ctrl rele ${isActive(0x08) ? 'active' : ''}`} onClick={() => onCommand('R4', 0x08)}>R4</button>
				</div>
			</div>

			{/* ŘADA 2: BRANCHES (Masky 0x100, 0x200, 0x400) */}
			<div className="control-sub-row">
				<div className="control-label">BRANCHES</div>
				<div className="control-grid-3">
					<button className={`btn-ctrl ${isActive(0x100) ? 'active' : ''}`} onClick={() => onCommand('B1', 0x100)}>B1</button>
					<button className={`btn-ctrl ${isActive(0x200) ? 'active' : ''}`} onClick={() => onCommand('B2', 0x200)}>B2</button>
					<button className={`btn-ctrl ${isActive(0x400) ? 'active' : ''}`} onClick={() => onCommand('B3', 0x400)}>B3</button>
				</div>
			</div>

			{/* ŘADA 3: SEMAFOR (Masky 0x10000, 0x20000, 0x40000, 0x80000) */}
			<div className="control-sub-row">
				<div className="control-label">SIGNAL TOWER</div>
				<div className="control-grid-4">
					<button className={`btn-light rd ${isActive(0x10000) ? 'active' : ''}`} onClick={() => onCommand('RD', 0x10000)}>RD</button>
					<button className={`btn-light or ${isActive(0x20000) ? 'active' : ''}`} onClick={() => onCommand('OR', 0x20000)}>OR</button>
					<button className={`btn-light gn ${isActive(0x40000) ? 'active' : ''}`} onClick={() => onCommand('GR', 0x40000)}>GR</button>
					<button className={`btn-light bu ${isActive(0x80000) ? 'active' : ''}`} onClick={() => onCommand('BU', 0x80000)}>BU</button>
				</div>
			</div>

			{/* ŘADA 4: TESTING / MAINTENANCE */}
			<div className="control-sub-row">
				<div className="control-label">MAINTENANCE / TEST</div>
				<div className="control-grid-1"> {/* Nový grid pro jedno široké tlačítko nebo více testů */}
					<button 
						className={`btn-ctrl fan-test`} 
						onClick={() => onCommand('FAN_TEST', 0x1000000)}
						style={{ borderLeft: '3px solid #0088ff' }}
					>
						FAN TEST
					</button>
				</div>
			</div>
		</div>
	);
};

export default ControlPanel;