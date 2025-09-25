 # frozen_string_literal: true

 class Internal::Companies::ShareClassesController < Internal::Companies::BaseController
   def index
     authorize ShareClass

     share_classes = Current.company.share_classes.select(:id, :name)
     render json: share_classes.as_json(only: [:id, :name])
   end
 end
