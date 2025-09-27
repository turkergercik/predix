'use client';

import React, { createContext, useContext, useReducer, useEffect } from 'react';

// X-inspired color palette based on the PXA logo
export const colors = {
  // Primary brand colors
  primary: {
    cyan: '#00D4FF',
    purple: '#8B5CF6',
    gradient: 'linear-gradient(135deg, #00D4FF 0%, #8B5CF6 100%)',
  },
  // Background colors
  background: {
    primary: '#0F172A', // Dark navy blue
    secondary: '#1E293B',
    tertiary: '#334155',
    card: '#1E293B',
    modal: 'rgba(15, 23, 42, 0.95)',
  },
  // Text colors
  text: {
    primary: '#F8FAFC',
    secondary: '#CBD5E1',
    muted: '#64748B',
    accent: '#00D4FF',
  },
  // Status colors
  status: {
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    info: '#3B82F6',
  },
  // Interactive colors
  interactive: {
    hover: 'rgba(0, 212, 255, 0.1)',
    active: 'rgba(0, 212, 255, 0.2)',
    border: '#334155',
    borderHover: '#00D4FF',
  }
};

// Helper functions for localStorage
const saveUserVotesToStorage = (userVotes) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('predix_user_votes', JSON.stringify(userVotes));
  }
};

const loadUserVotesFromStorage = () => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('predix_user_votes');
    return stored ? JSON.parse(stored) : {};
  }
  return {};
};

// Initial state
const initialState = {
  bets: [],
  loading: false,
  error: null,
  isAddBetModalOpen: false,
  selectedBet: null,
  userVotes: {}, // Track which bets the user has voted on: { betId: 'yes' | 'no' }
};

// Action types
const actionTypes = {
  SET_BETS: 'SET_BETS',
  ADD_BET: 'ADD_BET',
  UPDATE_BET: 'UPDATE_BET',
  DELETE_BET: 'DELETE_BET',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  TOGGLE_ADD_BET_MODAL: 'TOGGLE_ADD_BET_MODAL',
  SET_SELECTED_BET: 'SET_SELECTED_BET',
  VOTE_ON_BET: 'VOTE_ON_BET',
  SET_USER_VOTE: 'SET_USER_VOTE',
};

// Reducer function
function appReducer(state, action) {
  switch (action.type) {
    case actionTypes.SET_BETS:
      return { ...state, bets: action.payload, loading: false };
    
    case actionTypes.ADD_BET:
      return { 
        ...state, 
        bets: [...state.bets, action.payload],
        isAddBetModalOpen: false 
      };
    
    case actionTypes.UPDATE_BET:
      return {
        ...state,
        bets: state.bets.map(bet => 
          bet.id === action.payload.id ? action.payload : bet
        )
      };
    
    case actionTypes.DELETE_BET:
      return {
        ...state,
        bets: state.bets.filter(bet => bet.id !== action.payload)
      };
    
    case actionTypes.SET_LOADING:
      return { ...state, loading: action.payload };
    
    case actionTypes.SET_ERROR:
      return { ...state, error: action.payload, loading: false };
    
    case actionTypes.TOGGLE_ADD_BET_MODAL:
      return { 
        ...state, 
        isAddBetModalOpen: !state.isAddBetModalOpen 
      };
    
    case actionTypes.SET_SELECTED_BET:
      return { ...state, selectedBet: action.payload };
    
    case actionTypes.VOTE_ON_BET:
      return {
        ...state,
        bets: state.bets.map(bet => {
          if (bet.id === action.payload.betId) {
            const updatedVotes = { ...bet.votes };
            updatedVotes[action.payload.voteType] += 1;
            const totalVotes = updatedVotes.yes + updatedVotes.no;
            return { 
              ...bet, 
              votes: updatedVotes,
              totalVotes: totalVotes
            };
          }
          return bet;
        })
      };
    
    case actionTypes.SET_USER_VOTE:
      // Handle both single vote and bulk vote loading
      let newUserVotes;
      if (action.payload.userVotes) {
        // Bulk loading from localStorage
        newUserVotes = action.payload.userVotes;
      } else {
        // Single vote
        newUserVotes = {
          ...state.userVotes,
          [action.payload.betId]: action.payload.voteType
        };
      }
      
      // Only save to localStorage for single votes (not bulk loading)
      if (!action.payload.userVotes) {
        saveUserVotesToStorage(newUserVotes);
      }
      
      return {
        ...state,
        userVotes: newUserVotes
      };
    
    default:
      return state;
  }
}

// Create context
const AppContext = createContext();

// Context provider component
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Load bets and user votes on component mount
  useEffect(() => {
    loadBets();
    // Load user votes from localStorage
    const storedVotes = loadUserVotesFromStorage();
    if (Object.keys(storedVotes).length > 0) {
      dispatch({ 
        type: actionTypes.SET_USER_VOTE, 
        payload: { userVotes: storedVotes } 
      });
    }
  }, []);

  // API functions
  const loadBets = async () => {
    try {
      dispatch({ type: actionTypes.SET_LOADING, payload: true });
      const response = await fetch('/api/bets');
      if (!response.ok) throw new Error('Failed to load bets');
      const bets = await response.json();
      dispatch({ type: actionTypes.SET_BETS, payload: bets });
    } catch (error) {
      dispatch({ type: actionTypes.SET_ERROR, payload: error.message });
    }
  };

  const addBet = async (betData) => {
    try {
      dispatch({ type: actionTypes.SET_LOADING, payload: true });
      const response = await fetch('/api/bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(betData),
      });
      if (!response.ok) throw new Error('Failed to add bet');
      const newBet = await response.json();
      dispatch({ type: actionTypes.ADD_BET, payload: newBet });
      dispatch({ type: actionTypes.SET_LOADING, payload: false });
    } catch (error) {
      dispatch({ type: actionTypes.SET_ERROR, payload: error.message });
      dispatch({ type: actionTypes.SET_LOADING, payload: false });
      throw error; // Re-throw to let the modal handle it
    }
  };

  const voteOnBet = async (betId, voteType) => {
    // Check if user has already voted on this bet
    if (state.userVotes[betId]) {
      dispatch({ type: actionTypes.SET_ERROR, payload: 'You have already voted on this bet' });
      return;
    }

    try {
      const response = await fetch('/api/bets/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ betId, voteType }),
      });
      if (!response.ok) throw new Error('Failed to vote');
      const result = await response.json();
      
      // Update the bet and track the user's vote
      dispatch({ type: actionTypes.UPDATE_BET, payload: result.bet });
      dispatch({ type: actionTypes.SET_USER_VOTE, payload: { betId, voteType } });
    } catch (error) {
      dispatch({ type: actionTypes.SET_ERROR, payload: error.message });
    }
  };

  const deleteBet = async (betId) => {
    try {
      const response = await fetch(`/api/bets/${betId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete bet');
      dispatch({ type: actionTypes.DELETE_BET, payload: betId });
    } catch (error) {
      dispatch({ type: actionTypes.SET_ERROR, payload: error.message });
    }
  };

  const toggleAddBetModal = () => {
    dispatch({ type: actionTypes.TOGGLE_ADD_BET_MODAL });
  };

  const setSelectedBet = (bet) => {
    dispatch({ type: actionTypes.SET_SELECTED_BET, payload: bet });
  };

  const clearError = () => {
    dispatch({ type: actionTypes.SET_ERROR, payload: null });
  };

  const value = {
    ...state,
    colors,
    actions: {
      loadBets,
      addBet,
      voteOnBet,
      deleteBet,
      toggleAddBetModal,
      setSelectedBet,
      clearError,
    },
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

// Custom hook to use the context
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

export default AppContext;