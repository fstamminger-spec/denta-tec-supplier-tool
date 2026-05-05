
import React from 'react';
import type { QualityScoreName } from './types'; // For SEO score category consistency

export interface AttributeAnalysisDetail {
  field: string;
  count: number;
  total: number;
  percentage: number;
  headerExists?: boolean;
  status: 'good' | 'warning' | 'missing';
  foundInFeedCount?: number; // Added for COGS breakdown
  calculatedCount?: number;  // Added for COGS breakdown
}

export interface FeedAnalysisData {
  feedType: {
    type: 'XML' | 'CSV' | 'XLSX' | 'Unknown'; // Updated to include XLSX
    details: string;
  };
  itemCount: {
    totalParsed: number;
    details?: string; // e.g. "X <item>, Y <entry>"
  };
  attributeAnalysis: AttributeAnalysisDetail[];
  overallFeedHealth: {
    message: string;
    status: 'good' | 'warning' | 'error';
  };
}

interface FeedAnalysisReportProps {
  analysis: FeedAnalysisData;
  overallSeoScore: number | null;
  aiOptimizedSeoScore: number | null;
  aiOptimizedCount?: number;
}

// Simple SVG Icons
const CheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#4CAF50'}}><polyline points="20 6 9 17 4 12"></polyline></svg>;
export const WarningIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#FF9800'}}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>;
const ErrorIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#F44336'}}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>;
const InfoIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#2196F3' }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>;
const XmlIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: '#00385F'}}><path d="M10 20l4-16m4 16L6 4"/></svg>;
const CsvIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: '#00385F'}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>;
const FileIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: '#00385F'}}><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>;
const SparkleIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#ED6501' }}><path d="M12 2.5l1.55 5.55h5.8l-4.7 3.45 1.8 5.6-4.65-3.4-4.65 3.4 1.8-5.6-4.7-3.45h5.8z"/></svg>;


const FeedAnalysisReport: React.FC<FeedAnalysisReportProps> = ({ analysis, overallSeoScore, aiOptimizedSeoScore, aiOptimizedCount }) => {
    const PRIMARY_COLOR = "#00385F";
    const SECONDARY_COLOR = "#ED6501";
    const TEXT_COLOR_DARK = "#333";
    const BORDER_COLOR = "#e0e0e0";

    const styles: { [key: string]: React.CSSProperties } = {
        reportCard: {
          fontFamily: "'Inter', sans-serif",
          backgroundColor: '#fff',
          padding: '25px',
          borderRadius: '12px',
          boxShadow: '0 6px 16px rgba(0,0,0,0.07)',
          width: '100%',
          maxWidth: '950px',
          boxSizing: 'border-box',
          color: TEXT_COLOR_DARK,
        },
        section: {
          marginBottom: '25px',
        },
        sectionTitle: {
          fontSize: '1.3em',
          fontWeight: '600',
          color: PRIMARY_COLOR,
          borderBottom: `2px solid ${SECONDARY_COLOR}`,
          paddingBottom: '8px',
          marginBottom: '15px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        },
        detailItem: {
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          padding: '8px 0',
          borderBottom: `1px solid ${BORDER_COLOR}`,
          fontSize: '0.95em',
        },
        detailItemLast: {
          borderBottom: 'none',
        },
        detailLabel: {
          fontWeight: '500',
          color: '#555',
          minWidth: '120px',
        },
        detailValue: {
          flexGrow: 1,
          wordBreak: 'break-word',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        },
        statusIcon: {
          marginRight: '8px',
          flexShrink: 0,
          verticalAlign: 'middle', // Align icons better with text
        },
        attributeTable: {
          width: '100%',
          borderCollapse: 'collapse',
          marginTop: '10px',
        },
        tableHeader: {
          textAlign: 'left',
          padding: '10px 8px',
          borderBottom: `2px solid ${PRIMARY_COLOR}`,
          fontSize: '0.9em',
          color: PRIMARY_COLOR,
          fontWeight: '600',
        },
        tableCell: {
          padding: '10px 8px',
          borderBottom: `1px solid ${BORDER_COLOR}`,
          fontSize: '0.9em',
          verticalAlign: 'middle',
        },
        progressBarContainer: {
          width: '100%',
          backgroundColor: '#e0e0e0',
          borderRadius: '4px',
          height: '18px',
          overflow: 'hidden',
        },
        progressBar: {
          height: '100%',
          borderRadius: '4px 0 0 4px',
          transition: 'width 0.5s ease-in-out',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.75em',
          color: '#fff',
          fontWeight: 'bold',
        },
        seoScoresContainer: {
            display: 'flex',
            gap: '20px',
            marginTop: '15px',
            alignItems: 'stretch',
        },
        seoScoreSection: {
            flex: 1,
            textAlign: 'center',
            padding: '20px',
            backgroundColor: '#f9f9f9',
            borderRadius: '8px',
            border: `1px solid ${BORDER_COLOR}`,
            display: 'flex',
            flexDirection: 'column',
        },
        seoScoreTitle: {
            fontSize: '1em',
            fontWeight: '600',
            color: PRIMARY_COLOR,
            marginBottom: '10px',
        },
        seoScoreValue: {
            fontSize: '2.5em',
            fontWeight: 'bold',
            margin: '0 0 5px 0',
        },
        seoScoreCategoryText: {
            fontSize: '1.1em',
        },
        seoScoreDescription: {
            fontSize: '0.85em', 
            color: '#666', 
            marginTop: 'auto', 
            paddingTop: '10px',
        }
    };
    
    const getStatusIcon = (status: 'good' | 'warning' | 'error' | 'missing') => {
        if (status === 'good') return <CheckIcon />;
        if (status === 'warning') return <WarningIcon />;
        if (status === 'error' || status === 'missing') return <ErrorIcon />;
        return <InfoIcon />;
    };

    const getFeedTypeIcon = (type: FeedAnalysisData['feedType']['type']) => {
        if (type === 'XML') return <XmlIcon />;
        if (type === 'CSV') return <CsvIcon />;
        if (type === 'XLSX') return <FileIcon />; // Using generic file icon for XLSX
        return <InfoIcon />; // Default icon
    };


    const getProgressBarColor = (status: 'good' | 'warning' | 'missing') => {
        if (status === 'good') return '#4CAF50';
        if (status === 'warning') return '#FFC107';
        return '#F44336';
    };

    const getSeoScoreCategoryPercentage = (scorePercent: number | null): { text: string; color: string } => {
        if (scorePercent === null) return { text: "N/A", color: "#9E9E9E" };
        if (scorePercent >= 87.5) return { text: "Excellent", color: "#4CAF50" }; 
        if (scorePercent >= 62.5) return { text: "Good", color: "#8BC34A" };      
        if (scorePercent >= 37.5) return { text: "Fair", color: "#FFC107" };       
        if (scorePercent > 0) return { text: "Poor", color: "#F44336" };
        return { text: "N/A", color: "#9E9E9E" }; 
    };
    
    interface ScoreDisplayProps {
        title: string;
        score: number | null;
        description: string;
    }

    const ScoreDisplay: React.FC<ScoreDisplayProps> = ({ title, score, description }) => {
        const category = getSeoScoreCategoryPercentage(score);
        return (
            <div style={styles.seoScoreSection}>
                <h4 style={styles.seoScoreTitle}>{title}</h4>
                <div style={{...styles.seoScoreValue, color: category.color }}>
                    {score !== null ? `${score.toFixed(0)}%` : "N/A"}
                </div>
                <div style={{...styles.seoScoreCategoryText, color: category.color }}>
                    Category: {category.text}
                </div>
                <p style={styles.seoScoreDescription}>
                    {description}
                </p>
            </div>
        );
    };


    return (
        <div style={styles.reportCard}>
            <div style={styles.section}>
                <h3 style={styles.sectionTitle}>
                    {getFeedTypeIcon(analysis.feedType.type)}
                    Feed Summary
                </h3>
                <div style={styles.detailItem}>
                    <span style={styles.detailLabel}>Feed Type:</span>
                    <span style={styles.detailValue}>{analysis.feedType.type}</span>
                </div>
                <div style={styles.detailItem}>
                    <span style={styles.detailLabel}>Details:</span>
                    <span style={styles.detailValue}>{analysis.feedType.details}</span>
                </div>
                <div style={styles.detailItem}>
                    <span style={styles.detailLabel}>Products Parsed:</span>
                    <span style={styles.detailValue}>{analysis.itemCount.totalParsed}</span>
                </div>
                {analysis.itemCount.totalParsed > 0 && aiOptimizedCount !== undefined && (
                  <div style={styles.detailItem}>
                    <span style={styles.detailLabel}>AI Optimized:</span>
                    <span style={styles.detailValue}><SparkleIcon /> {aiOptimizedCount} of {analysis.itemCount.totalParsed} products</span>
                  </div>
                )}
                {analysis.itemCount.details && (
                    <div style={styles.detailItem}>
                        <span style={styles.detailLabel}>XML Counts:</span>
                        <span style={styles.detailValue}>{analysis.itemCount.details}</span>
                    </div>
                )}
                <div style={{...styles.detailItem, ...styles.detailItemLast, alignItems: 'center'}}>
                    <span style={styles.detailLabel}>Overall Health:</span>
                    <span style={styles.detailValue}><span style={styles.statusIcon}>{getStatusIcon(analysis.overallFeedHealth.status)}</span>{analysis.overallFeedHealth.message}</span>
                </div>
            </div>

            <div style={styles.section}>
                <h3 style={styles.sectionTitle}><InfoIcon />Content SEO Score</h3>
                 <div style={styles.seoScoresContainer}>
                    <ScoreDisplay
                        title="Overall Feed SEO Score"
                        score={overallSeoScore}
                        description="Average quality score across all products in the feed."
                    />
                     {aiOptimizedCount !== undefined && aiOptimizedCount > 0 && (
                        <ScoreDisplay
                            title="AI-Optimized SEO Score"
                            score={aiOptimizedSeoScore}
                            description={`Average quality score for the ${aiOptimizedCount} product(s) with AI-generated descriptions.`}
                        />
                    )}
                </div>
            </div>

            <div style={styles.section}>
                <h3 style={styles.sectionTitle}><CheckIcon />Attribute Analysis (Including COGS)</h3>
                <table style={styles.attributeTable}>
                    <thead>
                        <tr>
                            <th style={styles.tableHeader}>Attribute</th>
                            <th style={styles.tableHeader}>Found In</th>
                            <th style={{...styles.tableHeader, width: '40%'}}>Completeness</th>
                            <th style={styles.tableHeader}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {analysis.attributeAnalysis.map(attr => (
                            <tr key={attr.field}>
                                <td style={styles.tableCell}>{attr.field}</td>
                                <td style={styles.tableCell}>
                                    {attr.field === 'cost_of_goods_sold' && attr.foundInFeedCount !== undefined && attr.calculatedCount !== undefined
                                        ? `${attr.foundInFeedCount} original + ${attr.calculatedCount} calc. of ${attr.total}`
                                        : `${attr.count} of ${attr.total}`}
                                </td>
                                <td style={styles.tableCell}>
                                    {attr.headerExists || (attr.field === 'cost_of_goods_sold' && attr.count > 0) ? ( 
                                        <div style={styles.progressBarContainer}>
                                            <div style={{
                                                ...styles.progressBar,
                                                width: `${attr.percentage.toFixed(1)}%`,
                                                backgroundColor: getProgressBarColor(attr.status)
                                            }}>
                                                {attr.percentage.toFixed(1)}%
                                            </div>
                                        </div>
                                    ) : (
                                        <span style={{color: '#F44336'}}>Attribute Not Mapped/Found</span>
                                    )}
                                
                                </td>
                                <td style={{...styles.tableCell, textAlign: 'center'}}>{getStatusIcon(attr.status)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default FeedAnalysisReport;
