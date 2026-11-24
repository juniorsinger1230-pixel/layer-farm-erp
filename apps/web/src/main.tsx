import 'antd/dist/reset.css';
import 'dayjs/locale/zh-cn';
import { App as AntdApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { antdTheme } from './designTokens';
import { SessionProvider } from './auth/SessionContext';
import './styles/tokens.css';
import './styles/app.css';

function Root() {
  return (
    <ConfigProvider locale={zhCN} theme={antdTheme}>
      <AntdApp>
        <SessionProvider>
          <App />
        </SessionProvider>
      </AntdApp>
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Root /></React.StrictMode>);
