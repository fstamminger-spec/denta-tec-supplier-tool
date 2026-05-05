import React, { useState, useEffect } from 'react';
import { CORS_PROXY_URL } from './config';

export async function imageUrlToBase64(url: string): Promise<{base64: string, mimeType: string}> {
  try {
    // Try fetching through proxy to avoid CORS errors
    const fetchUrl = url.startsWith('http') ? `${CORS_PROXY_URL}${encodeURIComponent(url)}` : url;
    
    const response = await fetch(fetchUrl); 
    if (!response.ok) {
      throw new Error(`Failed to fetch image from ${url}: ${response.status} ${response.statusText}.`);
    }
    const blob = await response.blob();
    const mimeType = blob.type || 'image/jpeg'; 
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Check if result is valid data URI
        if (result.includes(',')) {
            resolve({ base64: result.split(',')[1], mimeType });
        } else {
            reject(new Error("Invalid Data URL created"));
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(blob);
    });
  } catch (error: any) {
    console.error(`Error converting image URL "${url}" to base64:`, error);
    throw error;
  }
}

export async function getImageDimensions(base64: string, mimeType: string): Promise<{width: number, height: number}> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = `data:${mimeType};base64,${base64}`;
  });
}

export const cleanStringForUrl = (str: string | undefined): string => {
    if (!str) return '';
    return str.toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
};

export const parsePrice = (priceString: string | number | undefined | null): number | null => {
    if (priceString === undefined || priceString === null || String(priceString).trim() === '') return null;
    
    // Handle formats like "1.200,50 €" or "1200.50"
    const potentialValues = String(priceString).trim().split(/\s+/);

    for (const val of potentialValues) {
        if (!val) continue;
        try {
            let cleanedString = val
                .replace(/[^\d.,-]/g, ''); // Remove currency symbols etc

            // Naive localization check: if comma is last separator, treat as decimal
            if (cleanedString.includes(',') && !cleanedString.includes('.')) {
                 cleanedString = cleanedString.replace(',', '.');
            } else if (cleanedString.includes('.') && cleanedString.includes(',')) {
                // Determine which is decimal separator based on position
                const lastDot = cleanedString.lastIndexOf('.');
                const lastComma = cleanedString.lastIndexOf(',');
                if (lastComma > lastDot) {
                    cleanedString = cleanedString.replace(/\./g, '').replace(',', '.');
                } else {
                    cleanedString = cleanedString.replace(/,/g, '');
                }
            }

            const numericValue = parseFloat(cleanedString);
            if (!isNaN(numericValue)) {
                return numericValue; 
            }
        } catch (error) {
            console.warn("Sub-value parsing error in parsePrice:", val, error);
        }
    }
    return null; 
};

export const useLocalStorage = <T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      if (typeof window !== 'undefined') {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : initialValue;
      }
      return initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(storedValue));
      }
    } catch (error) {
      console.error(error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
};

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      if (result.includes(',')) {
        resolve(result.split(',')[1]);
      } else {
        reject(new Error("Failed to convert blob to base64"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}