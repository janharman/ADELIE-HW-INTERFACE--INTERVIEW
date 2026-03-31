import React from 'react';

function TestInterface() {
  return (
    <div>
      <h2>Hardware Test Bench</h2>
      <button onClick={() => alert('Testing Relays...')}>Test Relays</button>
      <button onClick={() => alert('Testing LEDs...')}>Test LEDs</button>
    </div>
  );
}

export default TestInterface;