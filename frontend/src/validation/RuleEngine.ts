import { IRule, ValidationContext } from './types';

export class RuleEngine {
    private rules: IRule[] = [];

    constructor(rules: IRule[]) {
        this.rules = rules;
    }

    public validate(context: ValidationContext): { valid: boolean; errorKey?: string } {
        for (const rule of this.rules) {
            if (rule.shouldValidate(context)) {
                if (!rule.validate(context)) {
                    return { 
                        valid: false, 
                        errorKey: rule.getErrorMessageKey() 
                    };
                }
            }
        }
        return { valid: true };
    }
}
