import React from 'react';
import toast from 'react-hot-toast';
import client from '../../api/client';
import type { ProductFormData } from '../../utils/productsViewUtils';

interface UseProductPhotoUploadParams {
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
}

export default function useProductPhotoUpload({ setFormData }: UseProductPhotoUploadParams) {
  const [isPhotoUploading, setIsPhotoUploading] = React.useState(false);

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Для фото поддерживаются JPG, PNG и WEBP');
      event.target.value = '';
      return;
    }

    try {
      setIsPhotoUploading(true);
      const uploadFormData = new FormData();
      uploadFormData.append('photo', file);
      const res = await client.post('/upload', uploadFormData);

      if (res.data?.photoUrl) {
        setFormData((prev) => ({ ...prev, photoUrl: res.data.photoUrl }));
        toast.success('Фото успешно загружено');
      } else {
        toast.error('Не удалось получить ссылку на фото');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при загрузке фото');
    } finally {
      setIsPhotoUploading(false);
      event.target.value = '';
    }
  };

  return {
    isPhotoUploading,
    handlePhotoUpload,
  };
}
