import { useState, useCallback } from 'react';
import * as claudeService from '../services/claude';

// Hook for interacting with Claude AI features
export function useClaudeAI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const parseReceipt = useCallback(async (imageBase64, mediaType) => {
    setLoading(true);
    setError(null);
    try {
      const result = await claudeService.parseReceipt(imageBase64, mediaType);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const analyzeNutrition = useCallback(async (items) => {
    setLoading(true);
    setError(null);
    try {
      const result = await claudeService.analyzeNutrition(items);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const generateBatchCooking = useCallback(async (items) => {
    setLoading(true);
    setError(null);
    try {
      const result = await claudeService.generateBatchCooking(items);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getSmartSwaps = useCallback(async (items) => {
    setLoading(true);
    setError(null);
    try {
      const result = await claudeService.getSmartSwaps(items);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const generateShoppingList = useCallback(async (options) => {
    setLoading(true);
    setError(null);
    try {
      const result = await claudeService.generateShoppingList(options);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const researchNutrition = useCallback(async (items) => {
    setLoading(true);
    setError(null);
    try {
      const result = await claudeService.researchNutrition(items);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const importRecipe = useCallback(async (url, pastedText) => {
    setLoading(true);
    setError(null);
    try {
      const result = await claudeService.importRecipe(url, pastedText);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    loading,
    error,
    clearError,
    parseReceipt,
    analyzeNutrition,
    researchNutrition,
    generateBatchCooking,
    getSmartSwaps,
    generateShoppingList,
    importRecipe,
  };
}

export default useClaudeAI;
