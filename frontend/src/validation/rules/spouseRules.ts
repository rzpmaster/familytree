import { parseDate } from '../../lib/utils';
import { IRule } from '../types';

// 1. Opposite Gender Rule
export const OppositeGenderRule: IRule = {
    id: 'spouse-opposite-gender',
    shouldValidate: (ctx) => ctx.relationshipType === 'spouse',
    validate: (ctx) => {
        return ctx.source.gender !== ctx.target.gender;
    },
    getErrorMessageKey: () => 'validation.spouse_same_gender'
};

// 2. Lifespan Overlap Rule
export const LifespanOverlapRule: IRule = {
    id: 'spouse-lifespan-overlap',
    shouldValidate: (ctx) => ctx.relationshipType === 'spouse',
    validate: (ctx) => {
        // If dates are missing, we can't strictly validate, so we assume valid (or user policy?)
        // User said: "if they have birth/death dates"
        
        const sBirth = ctx.source.birth_date ? parseDate(ctx.source.birth_date) : null;
        const sDeath = ctx.source.death_date ? parseDate(ctx.source.death_date) : null;
        const tBirth = ctx.target.birth_date ? parseDate(ctx.target.birth_date) : null;
        const tDeath = ctx.target.death_date ? parseDate(ctx.target.death_date) : null;

        // If either side has NO dates at all, we might skip?
        // But if one has death date and other has birth date, we can check.
        
        // Define lifespan interval [start, end]
        // If birth missing, assume -Infinity? No, that's risky. 
        // Let's only check if we have enough info.
        
        // Case 1: Overlap logic
        // Interval A: [sBirth, sDeath] (if death missing, assume Alive/Now)
        // Interval B: [tBirth, tDeath]
        
        // However, "Alive" is tricky. If birth is 1000AD, they are not alive.
        // Let's only validate if BOTH birth and death exist, OR if we have clear non-overlap.
        
        // Simple check: S.death < T.birth OR T.death < S.birth
        
        if (sDeath && tBirth && sDeath < tBirth) return false;
        if (tDeath && sBirth && tDeath < sBirth) return false;
        
        return true;
    },
    getErrorMessageKey: () => 'validation.spouse_no_overlap'
};
