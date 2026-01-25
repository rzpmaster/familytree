import { parseDate } from '../../lib/utils';
import { IRule } from '../types';

// 1. Parent Age Rule (Parent must be at least 12 years older)
export const ParentAgeRule: IRule = {
    id: 'parent-age-gap',
    shouldValidate: (ctx) => ctx.relationshipType === 'parent-child',
    validate: (ctx) => {
        if (!ctx.source.birth_date || !ctx.target.birth_date) return true; // Skip if dates missing
        
        const parentBirth = parseDate(ctx.source.birth_date);
        const childBirth = parseDate(ctx.target.birth_date);
        
        // Calculate age difference
        // Simple approx: Year difference
        // const ageDiff = childBirth.getFullYear() - parentBirth.getFullYear();
        
        // Refine with months? User said "at least 12 years".
        // Let's compare timestamps.
        // 12 years in ms approx
        // Or add 12 years to parent birth and see if <= child birth
        
        const minParentAgeDate = new Date(parentBirth);
        minParentAgeDate.setFullYear(parentBirth.getFullYear() + 12);
        
        return minParentAgeDate <= childBirth;
    },
    getErrorMessageKey: () => 'validation.parent_too_young'
};

// 2. Child Birth Posthumous Rule
export const ChildBirthPosthumousRule: IRule = {
    id: 'child-birth-posthumous',
    shouldValidate: (ctx) => ctx.relationshipType === 'parent-child',
    validate: (ctx) => {
        if (!ctx.source.death_date || !ctx.target.birth_date) return true;
        
        const parentDeath = parseDate(ctx.source.death_date);
        const childBirth = parseDate(ctx.target.birth_date);
        
        // Check if Father or Mother
        if (ctx.source.gender === 'male') {
            // Father: Child birth < Father death + 10 months
            const maxPosthumousDate = new Date(parentDeath);
            maxPosthumousDate.setMonth(parentDeath.getMonth() + 10);
            
            return childBirth <= maxPosthumousDate;
        } else {
            // Mother: Child birth < Mother death (Mother must be alive at birth)
            // Actually, usually mother dies AT birth or AFTER.
            // So ChildBirth <= MotherDeath is acceptable (died in childbirth).
            // Strict < might fail if same day. <= is better.
            return childBirth <= parentDeath;
        }
    },
    getErrorMessageKey: () => 'validation.child_born_too_late'
};

// 3. Single Parent Set Rule (One Father, One Mother)
export const MaxParentsRule: IRule = {
    id: 'max-parents',
    shouldValidate: (ctx) => ctx.relationshipType === 'parent-child',
    validate: (ctx) => {
        // Source is Parent, Target is Child.
        const childId = ctx.target.id;
        const newParentGender = ctx.source.gender;
        
        // Find existing parent relationships for this child
        const existingParentEdges = ctx.existingEdges.filter(e => 
            e.target === childId && e.data?.type === 'parent-child'
        );
        
        // Check if any existing parent has the same gender
        for (const edge of existingParentEdges) {
            const parentId = edge.source;
            const parentNode = ctx.allNodes.find(n => n.id === parentId);
            
            if (parentNode) {
                if (parentNode.gender === newParentGender) {
                    return false; // Already has a parent of this gender
                }
            }
        }
        
        // Also limit total parents to 2? (Implicitly handled by gender check: max 1 male + 1 female = 2)
        if (existingParentEdges.length >= 2) {
             return false;
        }

        return true;
    },
    getErrorMessageKey: () => 'validation.too_many_parents'
};
