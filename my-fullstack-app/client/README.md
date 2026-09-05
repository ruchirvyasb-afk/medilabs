# Client Application

This is the client-side of the fullstack application built with React and TypeScript.

## Getting Started

To get started with the client application, follow these steps:

1. **Clone the repository**:
   ```
   git clone <repository-url>
   cd my-fullstack-app/client
   ```

2. **Install dependencies**:
   ```
   npm install
   ```

3. **Run the application**:
   ```
   npm run dev
   ```

   This will start the development server and you can view the application in your browser at `http://localhost:3000`.

## Project Structure

- `src/`: Contains the source code for the application.
  - `App.tsx`: Main application component.
  - `main.tsx`: Entry point for the React application.
  - `components/`: Contains reusable components.
    - `Header.tsx`: Header component.
  - `styles/`: Contains global styles.
    - `globals.css`: Global CSS styles.

## Building for Production

To build the application for production, run:
```
npm run build
```

This will create an optimized build of the application in the `dist` directory.

## Deployment

For deployment, you can use platforms like Vercel. Follow their documentation for deploying a Vite application.

## License

This project is licensed under the MIT License. See the LICENSE file for details.