import bcrypt from 'bcryptjs';

/**
 * Generate a random 6-digit key for transfer verification
 * @returns {string} 6-digit numeric key
 */
export const generateKey = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Hash a key using bcrypt
 * @param {string} key - Plain text key to hash
 * @returns {Promise<string>} Hashed key
 */
export const hashKey = async (key) => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(key, salt);
};

/**
 * Compare a plain key with a hashed key
 * @param {string} plainKey - Plain text key
 * @param {string} hashedKey - Hashed key to compare against
 * @returns {Promise<boolean>} True if keys match
 */
export const compareKeys = async (plainKey, hashedKey) => {
    return await bcrypt.compare(plainKey, hashedKey);
};
