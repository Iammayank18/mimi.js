import { Request, Response, NextFunction } from 'express';
import { verifyToken } from './authHelper';


interface DecodedToken {
    id: number;
    email: string;
}


declare global {
    namespace Express {
        interface Request {
            user?: DecodedToken;
        }
    }
}


const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        res.status(401).json({ message: 'No token provided' });
        return; // Ensure that the function returns after sending a response
    }

    const decoded = verifyToken(token);

    if (decoded === null) {
        res.status(401).json({ message: 'Invalid token' });
        return; // Ensure that the function returns after sending a response
    }

    // Type assertion: We know decoded is of type `DecodedToken` here
    req.user = decoded as DecodedToken;
    next(); // Call next() to pass control to the next middleware
};

export default authMiddleware;
