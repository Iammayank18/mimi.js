import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const SECRET_KEY = 'your_secret_key';

// Define the interface for the user object
interface User {
    id: number;
    email: string;
}

const hashPassword = async (password: string): Promise<string> => {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
};

const comparePassword = async (password: string, hash: string): Promise<boolean> => {
    return await bcrypt.compare(password, hash);
};

const generateToken = (user: User): string => {
    return jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '1h' });
};

const verifyToken = (token: string): jwt.JwtPayload | null => {
    try {
        return jwt.verify(token, SECRET_KEY) as jwt.JwtPayload;
    } catch (error) {
        return null;
    }
};

export {
    hashPassword,
    comparePassword,
    generateToken,
    verifyToken,
};
