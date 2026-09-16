// This file demonstrates React Native globals that ESLint should recognize
// but will FAIL in the PR's new config without reactNativeGlobals

if (__DEV__) {
  console.log('Development mode');
}

// React Native networking APIs
const response = await fetch('https://api.example.com/data');
const ws = new WebSocket('ws://example.com');

// React Native File APIs
const formData = new FormData();
const file = new File(['content'], 'test.txt');
const blob = new Blob(['data']);
const reader = new FileReader();

// React Native timer APIs
const timeoutId = setTimeout(() => {}, 1000);
const intervalId = setInterval(() => {}, 1000);
const rafId = requestAnimationFrame(() => {});

// React Native globals
console.log(global);
process.env.NODE_ENV;
Buffer.from('test');
TextEncoder;
TextDecoder;
URL;
URLSearchParams;
AbortController;
AbortSignal;
