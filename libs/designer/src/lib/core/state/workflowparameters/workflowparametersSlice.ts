import type { WorkflowParameter } from '../../../common/models/workflow';
import { validateParameterValueWithSwaggerType } from '../../utils/validation';
import { resetWorkflowState, setStateAfterUndoRedo } from '../global';
import type { WorkflowParameterUpdateEvent } from '@microsoft/designer-ui';
import { UIConstants } from '@microsoft/designer-ui';
import { getIntl, equals, getRecordEntry, guid } from '@microsoft/logic-apps-shared';
import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { UndoRedoPartialRootState } from '../undoRedo/undoRedoTypes';

export interface WorkflowParameterDefinition extends WorkflowParameter {
  name: string;
  isEditable: boolean;
}

export interface WorkflowParametersState {
  definitions: Record<string, WorkflowParameterDefinition>;
  validationErrors: Record<string, Record<string, string | undefined>>;
  isDirty: boolean;
}

export const initialState: WorkflowParametersState = {
  definitions: {},
  validationErrors: {},
  isDirty: false,
};

export const validateParameter = (
  id: string,
  data: { name?: string; type?: string; value?: string; defaultValue?: string },
  keyToValidate: string,
  allDefinitions: Record<string, WorkflowParameterDefinition>,
  required = true
): string | undefined => {
  const intl = getIntl();

  switch (keyToValidate?.toLowerCase()) {
    case 'name': {
      const { name } = data;
      if (!name) {
        return intl.formatMessage({
          defaultMessage: 'Must provide the parameter name.',
          id: 'Cj3/LJ',
          description: 'Error message when the workflow parameter name is empty.',
        });
      }

      const duplicateParameters = Object.keys(allDefinitions).filter(
        (parameterId) => parameterId !== id && equals(allDefinitions[parameterId].name, name)
      );

      return duplicateParameters.length > 0
        ? intl.formatMessage({
            defaultMessage: 'Parameter name already exists.',
            id: '8+0teU',
            description: 'Error message when the workflow parameter name already exists.',
          })
        : undefined;
    }

    case 'value':
    case 'defaultvalue': {
      const valueToValidate = equals(keyToValidate, 'value') ? data.value : data.defaultValue;
      const { type } = data;
      if (valueToValidate === '' || valueToValidate === undefined) {
        if (!required) {
          return undefined;
        }
        return intl.formatMessage({
          defaultMessage: 'Must provide value for parameter.',
          id: 'VL9wOu',
          description: 'Error message when the workflow parameter value is empty.',
        });
      }

      return validateParameterValueWithSwaggerType(type, valueToValidate, required, intl);
    }

    default:
      return undefined;
  }
};

export const workflowParametersSlice = createSlice({
  name: 'workflowParameters',
  initialState,
  reducers: {
    initializeParameters: (state, action: PayloadAction<Record<string, WorkflowParameterDefinition>>) => {
      state.definitions = action.payload;
    },
    addParameter: (state) => {
      const parameterId = guid();
      state.definitions[parameterId] = {
        isEditable: true,
        type: UIConstants.WORKFLOW_PARAMETER_SERIALIZED_TYPE.ARRAY,
        name: '',
      };
      state.isDirty = true;
    },
    deleteParameter: (state, action: PayloadAction<string>) => {
      const parameterId = action.payload;
      delete state.validationErrors[parameterId];
      delete state.definitions[parameterId];
      state.isDirty = true;
    },
    updateParameter: (state, action: PayloadAction<WorkflowParameterUpdateEvent>) => {
      const {
        id,
        newDefinition: { name, type, value, defaultValue },
        useLegacy = false,
      } = action.payload;
      const validationErrors = {
        name: validateParameter(id, { name }, 'name', state.definitions),
        value: validateParameter(id, { name, type, value, defaultValue }, 'value', state.definitions, !useLegacy),
        ...(useLegacy
          ? {
              defaultValue: validateParameter(id, { name, type, value, defaultValue }, 'defaultValue', state.definitions),
            }
          : {}),
      };

      state.definitions[id] = {
        ...(getRecordEntry(state.definitions, id) ?? ({} as any)),
        type,
        value,
        name: name ?? '',
        ...(useLegacy ? { defaultValue } : {}),
      };
      const newErrorObj = {
        ...(getRecordEntry(state.validationErrors, id) ?? {}),
        ...validationErrors,
      };
      if (!newErrorObj.name) {
        delete newErrorObj.name;
      }
      if (!newErrorObj.value) {
        delete newErrorObj.value;
      }
      if (!newErrorObj.defaultValue) {
        delete newErrorObj.defaultValue;
      }
      if (Object.keys(newErrorObj).length === 0) {
        delete state.validationErrors[id];
      } else {
        state.validationErrors[id] = newErrorObj;
      }
      state.isDirty = true;
    },
    setIsWorkflowParametersDirty: (state, action: PayloadAction<boolean>) => {
      state.isDirty = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(resetWorkflowState, () => initialState);
    builder.addCase(setStateAfterUndoRedo, (_, action: PayloadAction<UndoRedoPartialRootState>) => action.payload.workflowParameters);
  },
});

export const { initializeParameters, addParameter, deleteParameter, updateParameter, setIsWorkflowParametersDirty } =
  workflowParametersSlice.actions;

export default workflowParametersSlice.reducer;
