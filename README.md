# Graph Plotter

A Desmos-like graph plotting application with cloud storage and sharing features. Plot functions (Cartesian, Polar, Relations), calculate integrals/sums/derivatives, and save your graphs to the cloud.

## Features

- 📊 **Multiple Graph Types**: Cartesian (y=f(x)), Polar (r=g(θ)), and Relations (F(x,y)=0)
- 🧮 **Calculator**: Definite integrals, summations, and derivatives
- 💾 **Cloud Storage**: Save and load graphs from database
- 🔗 **Sharing**: Share graphs via public links or with specific users
- 🎨 **Variables**: Create adjustable variables with sliders
- 📐 **Intercepts**: Automatic detection and display of intercepts
- 🔐 **User Accounts**: Secure authentication with JWT tokens

## Quick Start (Frontend Only)

For basic usage without cloud features:

```bash
# Option 1: Open directly (may have CORS restrictions)
# Just open index.html in your browser

# Option 2: Serve locally (recommended)
python -m http.server 5174
# Then open http://localhost:5174
```

## Full Setup (With Backend)

### Prerequisites

- Node.js (v16+) and npm
- Python 3 (for local frontend server, optional)

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
# Edit .env and set:
# PORT=3000
# JWT_SECRET=your-secret-key-here
# FRONTEND_URL=http://localhost:5174
```

4. Start backend server:
```bash
npm start
# Server runs on http://localhost:3000
```

### Frontend Setup

1. In the project root, serve the frontend:
```bash
python -m http.server 5174
# Or use any static file server
```

2. Open in browser:
```
http://localhost:5174
```

### Environment Variables

**Backend (.env)**:
- `PORT`: Backend server port (default: 3000)
- `JWT_SECRET`: Secret key for JWT tokens (change in production!)
- `FRONTEND_URL`: Frontend URL for share links

**Frontend**: 
- Set `VITE_API_URL` environment variable or edit `src/api.js` to change API base URL

## Usage

### Creating Graphs

1. **Add Series**: Click "Add" in the Series section
2. **Choose Type**: Select Cartesian, Polar, or Relation
3. **Enter Expression**: 
   - Cartesian: `sin(x)`, `x^2 + 1`
   - Polar: `2*sin(3*θ)`
   - Relation: `x^2 + y^2 - 9` (circle)
4. **Customize**: Set name, color, visibility, enable derivative

### Variables

1. Click "+" in Variables section
2. Enter variable name (e.g., `a`, `b`)
3. Adjust value with slider or input
4. Use in expressions: `a*x + b`

### Saving to Cloud

1. **Login/Register**: Click "Sign in" to create account
2. **Save Graph**: Click 💾 button in "My Graphs" section
3. **Load Graph**: Click "Load" on any saved graph
4. **Share**: Click "Share" to get public link

### Calculator

- **Integral (∫)**: Calculate definite integrals
- **Sum (Σ)**: Summation over integer ranges  
- **Derivative (d/dx)**: Calculate derivative at a point

## API Endpoints

See `backend/README.md` for full API documentation.

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES6 modules), HTML5 Canvas, KaTeX, Math.js
- **Backend**: Node.js, Express, SQLite
- **Authentication**: JWT tokens, bcrypt password hashing
- **Deployment**: GitHub Pages (frontend), GitHub Actions (CI/CD)

## Project Structure

```
graph-plotter/
├── backend/          # Node.js API server
│   ├── server.js    # Express server & routes
│   └── package.json
├── src/
│   ├── app.js       # Main application logic
│   ├── plotter.js   # Canvas rendering engine
│   ├── auth.js      # Authentication module
│   └── api.js       # API client
├── index.html       # Main HTML
└── styles.css       # Styling
```

## License

MIT
