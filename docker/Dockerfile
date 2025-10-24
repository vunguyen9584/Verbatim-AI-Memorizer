# Sử dụng image NGINX chính thức, phiên bản alpine siêu nhẹ
FROM nginx:alpine

# Sao chép thư mục 'dist' đã được build vào thư mục phục vụ web của NGINX
COPY ./dist /usr/share/nginx/html

# Xóa file cấu hình mặc định của NGINX
RUN rm /etc/nginx/conf.d/default.conf

# Sao chép file cấu hình NGINX tùy chỉnh của bạn vào
COPY ./docker/nginx.conf /etc/nginx/conf.d/default.conf

# Mở cổng 80 để container có thể nhận request
EXPOSE 80

# Lệnh để khởi chạy NGINX khi container bắt đầu
CMD ["nginx", "-g", "daemon off;"]
