import 'dotenv/config';
import { io } from 'socket.io-client';

const serverUrl = process.env.SOCKET_TEST_URL ?? 'http://localhost:4000';
const siteId =
  process.env.SOCKET_TEST_ORG_ID ?? '00000000-0000-0000-0000-000000000001';

const socket = io(serverUrl, {
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log(`Connected with socket id ${socket.id}`);
  socket.emit('join:branch', { siteId });
});

socket.on('joined:branch', (payload) => {
  console.log('Joined branch room:', payload);
  socket.disconnect();
});

socket.on('error:join:branch', (error) => {
  console.error('Join branch error:', error);
  socket.disconnect();
});

socket.on('disconnect', () => {
  console.log('Disconnected from socket server');
});
