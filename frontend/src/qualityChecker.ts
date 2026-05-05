
import type { QualityScoreName, QualityScore } from './types';

const STOP_WORDS = new Set([
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "should", "can",
    "could", "may", "might", "must", "and", "but", "or", "nor", "for", "so", "new",
    "yet", "in", "on", "at", "by", "from", "to", "with", "about", "above", "set",
    "after", "again", "against", "all", "am", "any", "as", "because", "box", "pcs",
    "before", "below", "between", "both", "com", "de", "en", "und", "mit", "für", 
    "der", "die", "das", "ein", "eine", "einer", "it", "its", "itself", "let's",
    "me", "more", "most", "my", "myself", "no", "of", "once", "only", "other",
    "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "she", "pack",
    "he", "him", "her", "hers", "his", "how", "if", "into", "just", "least", "top",
    "less", "like", "not", "now", "g", "gr", "stk", "vpe", "mm", "cm", "kg", "ml", "l",
    "stk.", "vpe.", "stück", "gr.", "set", "kit", "incl", "inkl", "inc", "excl", "exkl", "zzgl"
]);

const normalizeText = (text: string): string => {
    return text.toLowerCase()
        .replace(/[^\w\s]|_/g, " ") // Replace punctuation with space
        .replace(/\s+/g, " ").trim(); // Normalize multiple spaces
};

export const analyzeTitle = (title: string | undefined): QualityScore => {
    if (!title || title.trim() === "") {
        return { score: 'N/A', message: "Title is missing.", details: `0 chars`, numericScore: 0 };
    }
    const len = title.length;
    let scoreName: QualityScoreName = 'OK';
    let numericScore = 2; // Default for OK
    let message = `Length: ${len} chars.`;

    if (len < 30) { scoreName = 'Too Short'; message += " Very short, may lack detail."; numericScore = 1; }
    else if (len < 50) { scoreName = 'Fair'; message += " A bit short, consider adding keywords."; numericScore = 2; }
    else if (len >= 50 && len <= 100) { scoreName = 'Optimal'; message += " Good length for SEO and readability."; numericScore = 4; }
    else if (len > 100 && len <= 150) { scoreName = 'Good'; message += " Within acceptable limits."; numericScore = 3;}
    else { scoreName = 'Too Long'; message += " Exceeds 150 chars, may be truncated."; numericScore = 1; }

    return { score: scoreName, message, details: `${len} chars`, numericScore };
};

export const analyzeDescription = (description: string | undefined): QualityScore => {
    if (!description || description.trim() === "") {
        return { score: 'N/A', message: "Description is missing.", details: `0 chars`, numericScore: 0 };
    }
    const len = description.length;
    let scoreName: QualityScoreName = 'OK';
    let numericScore = 2;
    let message = `Length: ${len} chars.`;

    if (len < 100) { scoreName = 'Too Short'; message += " Very short, consider elaborating."; numericScore = 1; }
    else if (len < 300) { scoreName = 'Fair'; message += " Could be more detailed for better SEO."; numericScore = 2; }
    else if (len >= 300 && len <= 1500) { scoreName = 'Good'; message += " Good, detailed length."; numericScore = 3; }
    else if (len > 1500 && len <= 5000) { scoreName = 'Excellent'; message += " Very comprehensive."; numericScore = 4; }
    else if (len > 5000) { scoreName = 'Too Long'; message += " Exceeds 5000 chars, ensure it's valuable content."; numericScore = 1; } // Penalize very long
    
    return { score: scoreName, message, details: `${len} chars`, numericScore };
};

export const analyzeKeywordDensity = (title: string | undefined, description: string | undefined): QualityScore => {
    if (!title || !description || title.trim() === "" || description.trim() === "") {
        return { score: 'N/A', message: "Title or description missing.", details: `N/A`, numericScore: 0, keywordsFound: 0, totalKeywords: 0 };
    }

    const titleKeywords = normalizeText(title)
        .split(' ')
        .filter(word => word.length > 2 && !STOP_WORDS.has(word) && !/^\d+$/.test(word)); // Exclude pure numbers

    if (titleKeywords.length === 0) {
        return { score: 'Fair', message: "No significant keywords in title.", details: `0/0 keywords` , numericScore: 1, keywordsFound: 0, totalKeywords: 0 };
    }

    const normalizedDescription = normalizeText(description);
    const foundKeywordsSet = new Set<string>();

    titleKeywords.forEach(keyword => {
        // Check for whole word match to avoid partial matches (e.g., "cat" in "caterpillar")
        const regex = new RegExp(`\\b${keyword}\\b`, 'g');
        if (regex.test(normalizedDescription)) {
            foundKeywordsSet.add(keyword);
        }
    });
    const keywordsInDescriptionCount = foundKeywordsSet.size;

    const percentage = (keywordsInDescriptionCount / titleKeywords.length) * 100;
    let scoreName: QualityScoreName = 'Poor';
    let numericScore = 1;
    let message = "";

    if (percentage >= 75) { scoreName = 'Excellent'; message = "Excellent keyword overlap."; numericScore = 4; }
    else if (percentage >= 50) { scoreName = 'Good'; message = "Good keyword overlap."; numericScore = 3; }
    else if (percentage >= 25) { scoreName = 'Fair'; message = "Some keywords found, could improve."; numericScore = 2; }
    else { scoreName = 'Poor'; message = "Low keyword overlap. Align description with title."; numericScore = 1; }
    
    const details = `${keywordsInDescriptionCount}/${titleKeywords.length} title keywords in description.`;
    return { score: scoreName, message, details, numericScore, keywordsFound: keywordsInDescriptionCount, totalKeywords: titleKeywords.length };
};
