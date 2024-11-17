const electron = require('electron');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const calculateGridPositions = (gridSize) => {
    const displays = electron.screen.getAllDisplays();
    const primaryDisplay = displays[0];
    const { width, height } = primaryDisplay.workAreaSize;
    
    const cellWidth = Math.floor(width / gridSize);
    const cellHeight = Math.floor(height / gridSize);

    return { cellWidth, cellHeight, screenWidth: width, screenHeight: height };
};

module.exports = { sleep, calculateGridPositions };