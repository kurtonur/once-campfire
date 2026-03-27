# frozen_string_literal: true

module Rooms
  class WebrtcIceController < ApplicationController
    before_action :set_room

    def show
      render json: { iceServers: Campfire::Rtc.ice_servers }
    end

    private
      def set_room
        @room = Current.user.rooms.find_by(id: params[:room_id])
        head :not_found unless @room&.direct?
      end
  end
end
