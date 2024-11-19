const electron = require('electron');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const calculateGridSize = (gridSize) => {
    const displays = electron.screen.getAllDisplays();
    const primaryDisplay = displays[0];
    const { width, height } = primaryDisplay.workAreaSize;
    
    const cellWidth = Math.floor(width / gridSize);
    const cellHeight = Math.floor(height / gridSize);

    return { cellWidth, cellHeight, screenWidth: width, screenHeight: height };
};

const calculateWindowPos = (position) => {
    const posX = (position % 8 + 1) % 3;
    const posY = Math.floor((position % 8 + 1) / 3);
    return { posX, posY };
}

module.exports = { sleep, calculateGridSize, calculateWindowPos };