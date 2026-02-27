"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllExceptionsFilter = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let AllExceptionsFilter = class AllExceptionsFilter {
    constructor(configService) {
        this.configService = configService;
    }
    catch(exception, host) {
        var _a;
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        const isDev = ((_a = this.configService.get('NODE_ENV')) !== null && _a !== void 0 ? _a : 'development') === 'development';
        if (exception instanceof common_1.HttpException) {
            const status = exception.getStatus();
            const exceptionResponse = exception.getResponse();
            if (exception instanceof common_1.NotFoundException) {
                const original = request.originalUrl || request.url;
                response.status(404).json(Object.assign({ message: `Not Found - ${original}` }, (isDev ? { stack: exception.stack } : {})));
                return;
            }
            if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
                response.status(status).json(exceptionResponse);
            }
            else {
                response.status(status).json({
                    message: typeof exceptionResponse === 'string' ? exceptionResponse : exception.message,
                });
            }
            return;
        }
        const statusCode = 500;
        const error = exception;
        response.status(statusCode).json(Object.assign({ message: (error === null || error === void 0 ? void 0 : error.message) || 'Something went wrong' }, (isDev ? { stack: error === null || error === void 0 ? void 0 : error.stack } : {})));
    }
};
exports.AllExceptionsFilter = AllExceptionsFilter;
exports.AllExceptionsFilter = AllExceptionsFilter = __decorate([
    (0, common_1.Catch)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AllExceptionsFilter);
//# sourceMappingURL=all-exceptions.filter.js.map