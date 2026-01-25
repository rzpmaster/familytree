import { GraphEdge, Member } from '../types';

export type RelationshipType = 'spouse' | 'parent-child';

export interface ValidationContext {
    source: Member;
    target: Member;
    relationshipType: RelationshipType;
    existingEdges: GraphEdge[]; // To check existing relationships
    allNodes: Member[]; // Needed to look up properties of related nodes
}

export interface IRule {
    id: string;
    /**
     * Determines if this rule applies to the given relationship type.
     */
    shouldValidate: (context: ValidationContext) => boolean;
    
    /**
     * Validates the rule. Returns true if valid, false if invalid.
     */
    validate: (context: ValidationContext) => boolean;
    
    /**
     * Returns the translation key for the error message.
     */
    getErrorMessageKey: () => string;
}
