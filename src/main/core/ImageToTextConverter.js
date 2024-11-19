const sharp = require('sharp');
const Tesseract = require('tesseract.js');

class ImageToTextConverter {
    constructor() {}

    async extractText(imagePath) {
        try {
            const binarizedImageBuffer = await this.binarizeImage(imagePath);
            
            const result = await Tesseract.recognize(
                binarizedImageBuffer,
                'eng',
                //{ logger: m => console.log(m) }
            );

            return result.data.text.trim();
        } catch (error) {
            console.error('Text extraction failed:', error);
            throw error;
        }
    }

    async binarizeImage(imagePath) {
        try {
            // 이미지의 메타데이터를 가져옵니다
            const metadata = await sharp(imagePath).metadata();
            
            // raw 픽셀 데이터를 RGB 형식으로 추출합니다
            const { data } = await sharp(imagePath)
                .raw()
                .toBuffer({ resolveWithObject: true });

            // 원본 코드와 동일한 이진화 처리
            for (let i = 0; i < data.length; i += 3) {  // RGB이므로 3픽셀씩
                // 동일한 밝기 계산식 사용
                const brightness = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                // 동일한 임계값(128) 사용
                const value = brightness < 128 ? 0 : 255;
                data[i] = value;     // R
                data[i + 1] = value; // G
                data[i + 2] = value; // B
            }

            // 처리된 데이터를 다시 이미지로 변환
            const binarizedImageBuffer = await sharp(data, {
                raw: {
                    width: metadata.width,
                    height: metadata.height,
                    channels: 3
                }
            })
            .png()
            .toBuffer();

            return binarizedImageBuffer;
        } catch (error) {
            console.error('Image binarization failed:', error);
            throw error;
        }
    }
}

module.exports = ImageToTextConverter;