// 导入NestJS测试模块
import { Test } from '@nestjs/testing';
// 导入视图服务
import { ViewsService } from '../services/views.service';
// 导入视图控制器
import { ViewsController } from './views.controller';
// 导入TestingModule类型
import type { TestingModule } from '@nestjs/testing';

// 描述视图控制器的测试套件
describe('ViewsController', () => {
  // 声明视图控制器变量
  let controller: ViewsController;

  // 在每个测试用例执行前的初始化操作
  beforeEach(async () => {
    // 创建测试模块
    const module: TestingModule = await Test.createTestingModule({
      // 注册要测试的控制器
      controllers: [ViewsController],
      // 注册控制器依赖的服务
      providers: [ViewsService],
    }).compile();  // 编译模块

    // 从模块中获取视图控制器实例
    controller = module.get<ViewsController>(ViewsController);
  });

  // 测试用例：验证控制器是否被正确定义
  it('should be defined', () => {
    // 断言控制器实例存在
    expect(controller).toBeDefined();
  });
});
