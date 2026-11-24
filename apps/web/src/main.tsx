import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import * as localeModule from 'antd/es/locale/zh_CN.js';
import type { Locale } from 'antd/es/locale/index.js';
import App from './App.js';
import './styles.css';
const zhCN = ((localeModule as unknown as { default?: Locale }).default ?? localeModule) as Locale;
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#2563eb', borderRadius: 8, colorBgLayout: '#f4f7fb' } }}><App /></ConfigProvider></React.StrictMode>);
