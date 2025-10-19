/**
 * 解码工具函数
 * 通过cf网页代理访问时，原网页的内容会被放到originalBodyBase64Encoded里，通过这个脚本解密，获取原始内容
 */

/**
 * 解码 originalBodyBase64Encoded 内容
 * @param htmlContent 原始 HTML 内容
 * @returns 解码后的 HTML 内容，如果没有找到编码内容则返回原始内容
 */
export function decodeOriginalBody(htmlContent: string): string {
    try {
        // 检查是否有 originalBodyBase64Encoded 内容
        const originalBodyMatch = htmlContent.match(/const originalBodyBase64Encoded = "([^"]+)"/);

        if (!originalBodyMatch) {
            // 没有找到编码内容，返回原始内容
            return htmlContent;
        }

        // 解码 originalBodyBase64Encoded
        const encodedString = originalBodyMatch[1];
        const bytes = new Uint8Array(encodedString.split(',').map(Number));
        const decodedContent = new TextDecoder('utf-8').decode(bytes);

        return decodedContent;
    } catch {
        // 如果解码失败，返回原始内容
        // 解码失败: error 可能的原因包括格式不正确或字符编码问题
        return htmlContent;
    }
}

/**
 * 检查是否包含 originalBodyBase64Encoded 内容
 * @param htmlContent HTML 内容
 * @returns 是否包含编码内容
 */
export function hasEncodedContent(htmlContent: string): boolean {
    return /const originalBodyBase64Encoded = "([^"]+)"/.test(htmlContent);
}
