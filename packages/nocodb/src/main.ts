// 导入 cors 模块，用于处理跨域资源共享
import cors from 'cors';
// 导入 express 模块，用于创建 Web 服务器
import express from 'express';
// 导入 Noco 类，这是 NocoDB 的核心模块
import Noco from '~/Noco';

// 创建一个 Express 应用实例
const server = express();
// 启用 'trust proxy' 选项，允许 Express 信任代理服务器的 IP 地址
server.enable('trust proxy');
// 禁用 ETag 功能，避免浏览器缓存响应
server.disable('etag');
// 禁用 'x-powered-by' 头信息，增强安全性
server.disable('x-powered-by');
// 使用 CORS 中间件处理跨域请求
server.use(
  cors({
    // 设置允许暴露的响应头，这里是 'xc-db-response'
    exposedHeaders: 'xc-db-response',
  }),
);

// 设置视图引擎为 EJS，用于渲染动态内容
server.set('view engine', 'ejs');

// 定义异步启动函数
async function bootstrap() {
  // 创建 HTTP 服务器并监听指定端口（环境变量 PORT 或默认 8080）
  const httpServer = server.listen(process.env.PORT || 8080, async () => {
    // 在服务器启动后，初始化 Noco 并将其作为中间件添加到 Express 应用
    server.use(await Noco.init({}, httpServer, server));
  });
}

// 调用启动函数，开始应用程序
bootstrap();
