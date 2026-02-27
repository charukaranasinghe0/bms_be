"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const common_1 = require("@nestjs/common");
const validateDto = async (cls, plain) => {
    const instance = (0, class_transformer_1.plainToInstance)(cls, plain);
    const errors = await (0, class_validator_1.validate)(instance, {
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
    });
    if (errors.length > 0) {
        const formatted = errors.map((err) => ({
            property: err.property,
            constraints: err.constraints,
        }));
        throw new common_1.BadRequestException({
            message: 'Validation failed',
            errors: formatted,
        });
    }
    return instance;
};
exports.validateDto = validateDto;
//# sourceMappingURL=validation.util.js.map