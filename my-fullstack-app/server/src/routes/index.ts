import { Router } from 'express';

const router = Router();

// Define your routes here
router.get('/', (req, res) => {
    res.send('API is running...');
});

// Export the router
export default router;