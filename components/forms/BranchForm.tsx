import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Branch } from '../../types';
import { Save, MapPin, Phone, Building } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const branchSchema = z.object({
  name: z.string().min(3, 'Branch name is required'),
  location: z.string().min(5, 'Address is required'),
  contactPhone: z.string().min(8, 'Valid phone number required'),
  isActive: z.boolean(),
});

type BranchFormValues = z.infer<typeof branchSchema>;

interface BranchFormProps {
  initialData?: Branch;
  onSave: (data: BranchFormValues) => Promise<void> | void;
  onCancel: () => void;
}

export const BranchForm: React.FC<BranchFormProps> = ({ initialData, onSave, onCancel }) => {
  const { t } = useTranslation();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<BranchFormValues>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: initialData?.name || '',
      location: initialData?.location || '',
      contactPhone: initialData?.contactPhone || '',
      isActive: initialData?.isActive ?? true,
    }
  });

  const onSubmit = async (data: BranchFormValues) => {
    await onSave(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <Building className="w-5 h-5 mr-2 text-primary-600" /> {t('branch_form_details')}
          </h3>

          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('branch_form_name_label')}</label>
              <input
                {...register('name')}
                placeholder={t('branch_form_name_placeholder')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-primary-500 focus:border-primary-500"
              />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message as string}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">{t('branch_form_location_label')}</label>
              <div className="relative mt-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MapPin className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('location')}
                  className="block w-full pl-10 rounded-md border-gray-300 shadow-sm border p-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              {errors.location && <p className="mt-1 text-xs text-red-600">{errors.location.message as string}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">{t('branch_form_contact_phone_label')}</label>
              <div className="relative mt-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('contactPhone')}
                  className="block w-full pl-10 rounded-md border-gray-300 shadow-sm border p-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              {errors.contactPhone && <p className="mt-1 text-xs text-red-600">{errors.contactPhone.message as string}</p>}
            </div>

            <div className="flex items-center space-x-3 bg-gray-50 p-4 rounded-lg">
              <input
                type="checkbox"
                id="isActive"
                {...register('isActive')}
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="isActive" className="font-medium text-gray-700">
                {t('branch_form_active_label')}
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
          {t('cancel')}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 flex items-center shadow-sm disabled:opacity-50"
        >
          <Save className="w-4 h-4 mr-2" /> {t('save_branch')}
        </button>
      </div>
    </form>
  );
};
