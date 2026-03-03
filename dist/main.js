"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const all_exceptions_filter_1 = require("./common/filters/all-exceptions.filter");
const config_1 = require("@nestjs/config");
async function bootstrap() {
    var _a;
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const configService = app.get(config_1.ConfigService);
    app.use((0, cookie_parser_1.default)());
    app.use((0, helmet_1.default)());
    app.use((0, morgan_1.default)('dev'));
    app.enableCors();
    app.setGlobalPrefix('api', {
        exclude: ['health'],
    });
    app.useGlobalFilters(new all_exceptions_filter_1.AllExceptionsFilter(configService));
    const port = (_a = app.get(config_1.ConfigService).get('PORT')) !== null && _a !== void 0 ? _a : 4000;
    await app.listen(port);
}
bootstrap();
//# sourceMappingURL=main.js.map