# Server Documentation

This is the backend server for the my-fullstack-app project. It is built using TypeScript and Express.

## Getting Started

To get started with the server, follow these steps:

1. **Clone the repository**:
   ```
   git clone https://github.com/yourusername/my-fullstack-app.git
   cd my-fullstack-app/server
   ```

2. **Install dependencies**:
   ```
   npm install
   ```

3. **Set up environment variables**:
   Copy the `.env.example` file to `.env` and fill in the required values.

4. **Run the server**:
   ```
   npm run start
   ```

## Folder Structure

- `src/index.ts`: Entry point for the server. Sets up the Express server and middleware.
- `src/routes/index.ts`: Defines the routes for the application.
- `src/controllers/index.ts`: Contains the logic for handling requests.
- `src/types/index.ts`: Defines TypeScript interfaces for the application.

## Scripts

- `npm run start`: Starts the server in production mode.
- `npm run dev`: Starts the server in development mode with hot reloading.

## Contributing

Feel free to submit issues and pull requests for any improvements or bug fixes.