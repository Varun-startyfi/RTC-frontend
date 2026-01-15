# Sessions Frontend

A Vue.js frontend application for live video sessions with real-time video/audio communication.

## Features

- **Session Creation**: Create instant video sessions
- **Session Joining**: Join existing sessions with session ID
- **Real-time Video**: HD video streaming with Agora RTC
- **Audio Controls**: Mute/unmute audio
- **Video Controls**: Turn camera on/off
- **Participant Management**: See all participants in real-time
- **Responsive Design**: Works on desktop and mobile

## Tech Stack

- **Vue 3** - Progressive JavaScript framework
- **Vite** - Fast build tool and development server
- **Agora RTC SDK** - Real-time video/audio communication
- **Socket.io** - Real-time communication
- **Vue Router** - Single-page application routing
- **Pinia** - State management

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:8080`

## Build for Production

```bash
npm run build
npm run preview
```

## Project Structure

```
src/
├── assets/          # Static assets and global styles
├── components/      # Reusable Vue components
├── views/          # Page components (Home, Session)
├── router/         # Vue Router configuration
├── services/       # API services
├── stores/         # Pinia stores (if needed)
├── App.vue         # Root component
└── main.js         # Application entry point
```

## Usage

### Creating a Session

1. Open the application
2. Enter your name
3. Click "Start Session"
4. Share the session ID with others

### Joining a Session

1. Open the application
2. Enter your name
3. Enter the session ID
4. Click "Join Session"

### In-Session Controls

- **Microphone**: Toggle audio on/off
- **Camera**: Toggle video on/off
- **End Session**: End the session (host only)

## Configuration

The frontend connects to the backend API at `http://localhost:3001`. To change this, update the API base URL in `src/services/sessionService.js`.

## Browser Support

- Chrome 70+
- Firefox 70+
- Safari 12+
- Edge 79+

## Permissions

The application requires camera and microphone permissions for video sessions. Make sure to:

1. Serve the application over HTTPS in production
2. Grant camera and microphone permissions when prompted

## Development

### Adding New Features

1. Create components in `src/components/`
2. Add routes in `src/router/index.js`
3. Create API calls in `src/services/`

### State Management

Use Pinia for global state management. Create stores in `src/stores/`.

### Styling

Global styles are in `src/assets/styles.css`. Component-specific styles use scoped CSS.

## API Integration

The frontend communicates with the backend through REST API calls and WebSocket connections:

- **REST API**: Session management (create, join, get info)
- **WebSocket**: Real-time participant updates

## Error Handling

The application includes comprehensive error handling for:

- Network failures
- Invalid session IDs
- Permission denials
- Provider connection issues

## Contributing

1. Follow Vue 3 composition API patterns
2. Use ESLint for code quality
3. Write descriptive commit messages
4. Test on multiple browsers

## License

MIT
